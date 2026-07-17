import { apiHono } from "@/hono/api";
import { hashAgenticCredential } from "./request";
import {
	agenticApiTokens,
	agenticEmailRecords,
	agenticManagementSessions,
	agenticSecurityEvents,
} from "./table";
import { AgenticTokenLimitError, generateAgenticToken } from "./token-authority";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	sessions: [] as StoredRow[],
	tokens: [] as StoredRow[],
	events: [] as StoredRow[],
	emails: [] as StoredRow[],
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("sessions")) return state.sessions;
	if (table === state.tables.get("tokens")) return state.tokens;
	if (table === state.tables.get("events")) return state.events;
	if (table === state.tables.get("emails")) return state.emails;
	return [];
}

function stringParams(condition: unknown): string[] {
	if (!condition || typeof condition !== "object") return [];
	if ("value" in condition && typeof condition.value === "string") {
		return [condition.value];
	}
	if (!("queryChunks" in condition) || !Array.isArray(condition.queryChunks)) return [];
	return condition.queryChunks.flatMap(stringParams);
}

function updateRow(table: unknown, values: StoredRow, condition: unknown): StoredRow[] {
	const rows = rowsFor(table);
	const params = stringParams(condition);
	const row =
		rows.find((candidate) => typeof candidate.id === "string" && params.includes(candidate.id)) ??
		rows.find(
			(candidate) =>
				(typeof candidate.tokenHash === "string" && params.includes(candidate.tokenHash)) ||
				(typeof candidate.sessionHash === "string" && params.includes(candidate.sessionHash)),
		);
	if (!row || (params.includes("active") && row.status !== "active")) return [];
	Object.assign(row, values);
	return [row];
}

function insertRows(table: unknown, rows: StoredRow[]): StoredRow[] {
	const target = rowsFor(table);
	const inserted = rows.map((row, index) => ({
		id: `c0000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: (condition: unknown) => {
					const params = stringParams(condition);
					const rows = rowsFor(table).filter((row) =>
						params.every((param) => Object.values(row).includes(param)),
					);
					return Object.assign(Promise.resolve(rows), {
						limit: async (count: number) => rows.slice(0, count),
					});
				},
			}),
		}),
		insert: (table: unknown) => ({
			values: (rows: StoredRow | StoredRow[]) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (values: StoredRow) => ({
				where: (condition: unknown) => ({
					returning: async () => updateRow(table, values, condition),
				}),
			}),
		}),
	}),
}));

describe("agentic onboarding token generation", () => {
	beforeEach(async () => {
		state.tables = new Map<string, unknown>([
			["sessions", agenticManagementSessions],
			["tokens", agenticApiTokens],
			["events", agenticSecurityEvents],
			["emails", agenticEmailRecords],
		]);
		state.sessions = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				linkId: "10000000-0000-4000-8000-000000000001",
				email: "agent@example.com",
				sessionHash: await hashAgenticCredential("raw-management-session"),
				status: "active",
				expiresAt: new Date("2026-07-17T08:15:00.000Z"),
			},
		];
		state.tokens = [];
		state.events = [];
		state.emails = [];
	});

	it("requires the management session, full-authority acknowledgment, and 256-bit secret", async () => {
		// Issue #44 token assumptions before RED:
		// - Bearer credentials never substitute for the dedicated browser session.
		// - Name is trimmed/non-empty and acknowledgment must be literal true.
		// - Secret material is 32 CSPRNG bytes encoded after signmos_; only SHA-256 plus safe hint persist.
		// - The raw token exists only in this successful response, never in audit rows.
		const request = (input: { cookie?: string; body: unknown; origin?: string }) =>
			apiHono.request("/api/agentic/tokens", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: input.origin ?? "http://localhost",
					...(input.cookie ? { cookie: input.cookie } : {}),
					"x-now": "2026-07-17T08:14:59.999Z",
				},
				body: JSON.stringify(input.body),
			});

		const bearerOnly = await apiHono.request("/api/agentic/tokens", {
			method: "POST",
			headers: {
				authorization: "Bearer signmos_not_a_management_session",
				"content-type": "application/json",
				origin: "http://localhost",
			},
			body: JSON.stringify({ name: "Codex", acknowledgeFullAuthority: true }),
		});
		expect(bearerOnly.status).toBe(401);

		const cookie = "signmos_agentic_management=raw-management-session";
		const invalid = await request({
			cookie,
			body: { name: " ", acknowledgeFullAuthority: false },
		});
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toEqual({
			error: {
				code: "INVALID_AGENTIC_TOKEN_REQUEST",
				message: "A token name and full-authority acknowledgment are required",
				fields: ["name", "acknowledgeFullAuthority"],
			},
		});

		const generated = await request({
			cookie,
			body: { name: " Codex laptop ", acknowledgeFullAuthority: true },
		});
		expect(generated.status).toBe(201);
		expect(generated.headers.get("cache-control")).toBe("no-store");
		const body = (await generated.json()) as {
			data: { secret: string; token: { id: string; name: string; hint: string } };
		};
		expect(body.data.token.name).toBe("Codex laptop");
		expect(body.data.secret).toMatch(/^signmos_[A-Za-z0-9_-]+$/);
		expect(Buffer.from(body.data.secret.slice("signmos_".length), "base64url")).toHaveLength(32);
		expect(body.data.token.hint).not.toBe(body.data.secret);

		expect(state.tokens).toEqual([
			expect.objectContaining({
				email: "agent@example.com",
				name: "Codex laptop",
				tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				tokenHint: body.data.token.hint,
				status: "active",
			}),
		]);
		expect(JSON.stringify([state.tokens, state.events])).not.toContain(body.data.secret);
		expect(state.events).toEqual([
			expect.objectContaining({
				tokenId: body.data.token.id,
				tokenName: "Codex laptop",
				email: "agent@example.com",
				eventType: "agentic.token.created",
				actorType: "browser",
			}),
		]);
	});

	it("agent token lifecycle enforces five active slots and reuses only a revoked slot", async () => {
		// Issue #45 numeric-bound assumptions before RED:
		// - Active slots are 1..5 and a database uniqueness constraint protects email+slot.
		// - Revoked rows remain retained with a null slot and do not count toward the cap.
		// - The sixth active token fails before a secret-bearing response is returned.
		const session = { id: String(state.sessions[0]?.id), email: "agent@example.com" };
		for (let number = 1; number <= 5; number += 1) {
			await generateAgenticToken({ session, name: `Agent ${number}` });
		}
		expect(state.tokens.map((token) => token.activeSlot)).toEqual([1, 2, 3, 4, 5]);

		await expect(generateAgenticToken({ session, name: "Sixth agent" })).rejects.toBeInstanceOf(
			AgenticTokenLimitError,
		);
		expect(state.tokens).toHaveLength(5);

		Object.assign(state.tokens[1] ?? {}, { status: "revoked", activeSlot: null });
		await generateAgenticToken({ session, name: "Replacement agent" });
		expect(state.tokens).toHaveLength(6);
		expect(state.tokens.at(-1)?.activeSlot).toBe(2);
	});

	it("agent token lifecycle counts an active token created before slot enforcement", async () => {
		state.tokens.push({
			id: "30000000-0000-4000-8000-000000000099",
			email: "agent@example.com",
			name: "Existing token",
			tokenHash: "0".repeat(64),
			tokenHint: "signmos_…old1",
			status: "active",
			activeSlot: null,
			createdAt: new Date("2026-07-17T07:00:00.000Z"),
		});
		const session = { id: String(state.sessions[0]?.id), email: "agent@example.com" };
		for (let number = 1; number <= 4; number += 1) {
			await generateAgenticToken({ session, name: `New agent ${number}` });
		}
		await expect(
			generateAgenticToken({ session, name: "Would exceed total cap" }),
		).rejects.toBeInstanceOf(AgenticTokenLimitError);
		expect(state.tokens).toHaveLength(5);
	});

	it("agent token lifecycle retains all revoked metadata until pagination exists", async () => {
		state.tokens.push(
			...Array.from({ length: 101 }, (_, index) => ({
				id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
				email: "agent@example.com",
				name: `Revoked agent ${index + 1}`,
				tokenHash: String(index).padStart(64, "0"),
				tokenHint: `signmos_…${String(index).padStart(4, "0")}`,
				status: "revoked",
				activeSlot: null,
				lastUsedAt: null,
				revokedAt: new Date("2026-07-17T08:00:00.000Z"),
				createdAt: new Date("2026-07-17T07:00:00.000Z"),
			})),
		);
		const response = await apiHono.request("/api/agentic/tokens", {
			headers: {
				cookie: "signmos_agentic_management=raw-management-session",
				"x-now": "2026-07-17T08:10:00.000Z",
			},
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: { tokens: unknown[] } };
		expect(body.data.tokens).toHaveLength(101);
		expect(JSON.stringify(body)).not.toMatch(/tokenHash|token_hash/);
	});

	it("agent token lifecycle returns a stable error for the sixth API token", async () => {
		const request = (number: number) =>
			apiHono.request("/api/agentic/tokens", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: "signmos_agentic_management=raw-management-session",
					origin: "http://localhost",
					"x-now": "2026-07-17T08:14:59.999Z",
				},
				body: JSON.stringify({
					name: `Agent ${number}`,
					acknowledgeFullAuthority: true,
				}),
			});
		for (let number = 1; number <= 5; number += 1) {
			expect((await request(number)).status).toBe(201);
		}

		const sixth = await request(6);
		expect(sixth.status).toBe(409);
		await expect(sixth.json()).resolves.toEqual({
			error: {
				code: "AGENTIC_TOKEN_LIMIT",
				message: "Revoke an active token before creating another",
				limit: 5,
			},
		});
	});

	it("agent token lifecycle lists safely, revokes independently, and outlives access sessions", async () => {
		// Issue #45 lifecycle assumptions before RED:
		// - Management operations require the live browser session; Bearer never substitutes for it.
		// - Revocation is immediate while other tokens remain independent and non-expiring.
		// - Revoked metadata is retained, but neither responses nor audits expose hashes or secrets.
		const cookie = "signmos_agentic_management=raw-management-session";
		const origin = "http://localhost";
		const secrets: string[] = [];
		for (let number = 1; number <= 5; number += 1) {
			const response = await apiHono.request("/api/agentic/tokens", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie,
					origin,
					"x-now": "2026-07-17T08:10:00.000Z",
				},
				body: JSON.stringify({
					name: `Agent ${number}`,
					acknowledgeFullAuthority: true,
				}),
			});
			const body = (await response.json()) as { data: { secret: string } };
			secrets.push(body.data.secret);
		}

		const bearerOnlyList = await apiHono.request("/api/agentic/tokens", {
			headers: { authorization: `Bearer ${secrets[0]}` },
		});
		expect(bearerOnlyList.status).toBe(401);

		const list = await apiHono.request("/api/agentic/tokens", {
			headers: { cookie, "x-now": "2026-07-17T08:10:00.000Z" },
		});
		expect(list.status).toBe(200);
		const listed = (await list.json()) as {
			data: { activeLimit: number; tokens: Array<Record<string, unknown>> };
		};
		expect(listed.data.activeLimit).toBe(5);
		expect(listed.data.tokens).toHaveLength(5);
		expect(listed.data.tokens[0]).toEqual({
			id: expect.any(String),
			name: expect.any(String),
			hint: expect.stringMatching(/^signmos_…/),
			createdAt: expect.any(String),
			lastUsedAt: null,
			status: "active",
			revokedAt: null,
		});
		expect(JSON.stringify(listed)).not.toMatch(/tokenHash|token_hash|secret/);

		const revokedId = String(listed.data.tokens[1]?.id);
		const bearerOnlyRevoke = await apiHono.request(`/api/agentic/tokens/${revokedId}`, {
			method: "DELETE",
			headers: { authorization: `Bearer ${secrets[1]}`, origin },
		});
		expect(bearerOnlyRevoke.status).toBe(401);

		const revoked = await apiHono.request(`/api/agentic/tokens/${revokedId}`, {
			method: "DELETE",
			headers: { cookie, origin, "x-now": "2026-07-17T08:11:00.000Z" },
		});
		expect(revoked.status).toBe(200);
		await expect(revoked.json()).resolves.toEqual({
			data: {
				token: expect.objectContaining({ id: revokedId, status: "revoked" }),
			},
		});

		const replacement = await apiHono.request("/api/agentic/tokens", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie,
				origin,
				"x-now": "2026-07-17T08:12:00.000Z",
			},
			body: JSON.stringify({ name: "Replacement", acknowledgeFullAuthority: true }),
		});
		expect(replacement.status).toBe(201);
		const afterReplacement = await apiHono.request("/api/agentic/tokens", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie,
				origin,
				"x-now": "2026-07-17T08:13:00.000Z",
			},
			body: JSON.stringify({ name: "No extra slot", acknowledgeFullAuthority: true }),
		});
		expect(afterReplacement.status).toBe(409);

		const revokedIdentity = await apiHono.request("/api/v1/me", {
			headers: {
				authorization: `Bearer ${secrets[1]}`,
				"x-now": "2026-07-17T09:00:00.000Z",
			},
		});
		expect(revokedIdentity.status).toBe(401);
		await expect(revokedIdentity.json()).resolves.toEqual({
			error: {
				code: "AGENTIC_TOKEN_REQUIRED",
				message: "Use Authorization: Bearer <token>",
			},
		});
		for (const secret of secrets.filter((_, index) => index !== 1)) {
			const identity = await apiHono.request("/api/v1/me", {
				headers: {
					authorization: `Bearer ${secret}`,
					"x-now": "2026-07-17T09:00:00.000Z",
				},
			});
			expect(identity.status).toBe(200);
		}

		const retained = await apiHono.request("/api/agentic/tokens", {
			headers: { cookie, "x-now": "2026-07-17T08:14:00.000Z" },
		});
		const retainedBody = (await retained.json()) as {
			data: { tokens: Array<{ id: string; status: string; revokedAt: string | null }> };
		};
		expect(retainedBody.data.tokens).toHaveLength(6);
		expect(retainedBody.data.tokens).toContainEqual(
			expect.objectContaining({ id: revokedId, status: "revoked", revokedAt: expect.any(String) }),
		);
		expect(state.emails).toHaveLength(0);
		expect(state.events).toContainEqual(
			expect.objectContaining({
				tokenId: revokedId,
				eventType: "agentic.token.revoked",
				actorType: "browser",
			}),
		);
		expect(JSON.stringify(state.events)).not.toContain(secrets[1]);
		expect(JSON.stringify(state.events)).not.toMatch(/[a-f0-9]{64}/);
	});
});
