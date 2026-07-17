import { apiHono } from "@/hono/api";
import { hashAgenticCredential } from "./request";
import { agenticApiTokens, agenticSecurityEvents } from "./table";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	tokens: [] as StoredRow[],
	events: [] as StoredRow[],
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("tokens")) return state.tokens;
	if (table === state.tables.get("events")) return state.events;
	return [];
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }),
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
		insert: (table: unknown) => ({
			values: (row: StoredRow) => ({
				returning: async () => {
					const inserted = {
						id: `d0000000-0000-4000-8000-${String(rowsFor(table).length + 1).padStart(12, "0")}`,
						createdAt: new Date("2026-07-17T08:00:00.000Z"),
						...row,
					};
					rowsFor(table).push(inserted);
					return [inserted];
				},
			}),
		}),
	}),
}));

describe("agentic onboarding bearer identity", () => {
	const rawToken = "signmos_identity_test_token";

	beforeEach(async () => {
		state.tables = new Map<string, unknown>([
			["tokens", agenticApiTokens],
			["events", agenticSecurityEvents],
		]);
		state.tokens = [
			{
				id: "30000000-0000-4000-8000-000000000001",
				email: "agent@example.com",
				name: "Codex laptop",
				tokenHash: await hashAgenticCredential(rawToken),
				tokenHint: "signmos_…oken",
				status: "active",
				lastUsedAt: null,
				createdAt: new Date("2026-07-17T08:00:00.000Z"),
			},
		];
		state.events = [];
	});

	it("accepts only Authorization Bearer and returns a safe audited principal", async () => {
		// Issue #44 bearer assumptions before RED:
		// - Cookies, query credentials, internal headers, missing and malformed schemes are all denied.
		// - The response contains normalized email and safe token metadata, never token/hash material.
		// - Each accepted sensitive read records stable token identity with actorType agent.
		const deniedRequests = [
			new Request("http://localhost/api/v1/me"),
			new Request("http://localhost/api/v1/me", {
				headers: { authorization: `Basic ${rawToken}` },
			}),
			new Request(`http://localhost/api/v1/me?token=${rawToken}`),
			new Request("http://localhost/api/v1/me", {
				headers: { cookie: `signmos_agentic_management=${rawToken}` },
			}),
			new Request("http://localhost/api/v1/me", {
				headers: { "x-internal-user-id": "agent@example.com" },
			}),
		];
		for (const request of deniedRequests) {
			const denied = await apiHono.request(request);
			expect(denied.status).toBe(401);
			await expect(denied.json()).resolves.toEqual({
				error: {
					code: "AGENTIC_TOKEN_REQUIRED",
					message: "Use Authorization: Bearer <token>",
				},
			});
		}

		const response = await apiHono.request("/api/v1/me", {
			headers: {
				authorization: `Bearer ${rawToken}`,
				"x-now": "2026-07-17T08:05:00.000Z",
			},
		});
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			data: {
				principal: { email: "agent@example.com", actorType: "agent" },
				token: {
					id: "30000000-0000-4000-8000-000000000001",
					name: "Codex laptop",
					hint: "signmos_…oken",
					createdAt: "2026-07-17T08:00:00.000Z",
					lastUsedAt: "2026-07-17T08:05:00.000Z",
				},
			},
		});
		expect(JSON.stringify(body)).not.toContain(rawToken);
		expect(JSON.stringify(body)).not.toContain(state.tokens[0]?.tokenHash);
		expect(state.events).toEqual([
			expect.objectContaining({
				email: "agent@example.com",
				tokenId: "30000000-0000-4000-8000-000000000001",
				tokenName: "Codex laptop",
				eventType: "agentic.identity.read",
				actorType: "agent",
			}),
		]);
		expect(JSON.stringify(state.events)).not.toContain(rawToken);
		expect(JSON.stringify(state.events)).not.toContain(state.tokens[0]?.tokenHash);
	});
});
