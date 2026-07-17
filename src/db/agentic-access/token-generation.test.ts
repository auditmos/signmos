import { apiHono } from "@/hono/api";
import { hashAgenticCredential } from "./request";
import { agenticApiTokens, agenticManagementSessions, agenticSecurityEvents } from "./table";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	sessions: [] as StoredRow[],
	tokens: [] as StoredRow[],
	events: [] as StoredRow[],
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("sessions")) return state.sessions;
	if (table === state.tables.get("tokens")) return state.tokens;
	if (table === state.tables.get("events")) return state.events;
	return [];
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
			from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }),
		}),
		insert: (table: unknown) => ({
			values: (rows: StoredRow | StoredRow[]) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (values: StoredRow) => ({
				where: () => ({
					returning: async () => {
						const row = rowsFor(table).find((candidate) => candidate.status === "active");
						if (!row) return [];
						Object.assign(row, values);
						return [row];
					},
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
});
