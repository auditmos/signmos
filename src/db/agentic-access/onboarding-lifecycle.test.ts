import { apiHono } from "@/hono/api";
import {
	agenticAccessLinks,
	agenticAccessRequests,
	agenticApiTokens,
	agenticEmailRecords,
	agenticManagementSessions,
	agenticSecurityEvents,
} from "./table";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	links: [] as StoredRow[],
	requests: [] as StoredRow[],
	emails: [] as StoredRow[],
	sessions: [] as StoredRow[],
	tokens: [] as StoredRow[],
	events: [] as StoredRow[],
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("links")) return state.links;
	if (table === state.tables.get("requests")) return state.requests;
	if (table === state.tables.get("emails")) return state.emails;
	if (table === state.tables.get("sessions")) return state.sessions;
	if (table === state.tables.get("tokens")) return state.tokens;
	if (table === state.tables.get("events")) return state.events;
	return [];
}

function insertRows(table: unknown, rows: StoredRow[], ignoreConflict = false): StoredRow[] {
	const target = rowsFor(table);
	if (
		ignoreConflict &&
		table === state.tables.get("requests") &&
		rows.some((row) => target.some((stored) => stored.idempotencyKey === row.idempotencyKey))
	) {
		return [];
	}
	const inserted = rows.map((row, index) => ({
		id: `a0000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

function updateRows(table: unknown, values: StoredRow): StoredRow[] {
	const target = rowsFor(table);
	let row: StoredRow | undefined;
	if (table === state.tables.get("requests")) {
		row = [...target].reverse().find((candidate) => candidate.linkId == null);
	} else if (table === state.tables.get("links")) {
		row = [...target].reverse().find((candidate) => {
			if (values.status === "active") return candidate.status === "pending";
			if (values.status === "consumed") {
				return (
					candidate.status === "active" &&
					candidate.expiresAt instanceof Date &&
					values.consumedAt instanceof Date &&
					candidate.expiresAt > values.consumedAt
				);
			}
			return candidate.status === "active";
		});
	} else {
		row = [...target].reverse().find((candidate) => candidate.status === "active");
	}
	if (!row) return [];
	Object.assign(row, values);
	return [row];
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }),
		}),
		insert: (table: unknown) => ({
			values: (rows: StoredRow | StoredRow[]) => {
				const input = Array.isArray(rows) ? rows : [rows];
				return {
					returning: async () => insertRows(table, input),
					onConflictDoNothing: () => ({
						returning: async () => insertRows(table, input, true),
					}),
				};
			},
		}),
		update: (table: unknown) => ({
			set: (values: StoredRow) => ({
				where: () => ({ returning: async () => updateRows(table, values) }),
			}),
		}),
	}),
}));

describe("agentic onboarding request lifecycle", () => {
	beforeEach(() => {
		state.tables = new Map<string, unknown>([
			["links", agenticAccessLinks],
			["requests", agenticAccessRequests],
			["emails", agenticEmailRecords],
			["sessions", agenticManagementSessions],
			["tokens", agenticApiTokens],
			["events", agenticSecurityEvents],
		]);
		state.links = [];
		state.requests = [];
		state.emails = [];
		state.sessions = [];
		state.tokens = [];
		state.events = [];
	});

	it("issues one hashed 30-minute link while keeping the public response enumeration-safe", async () => {
		const request = () =>
			apiHono.request(
				"/api/agentic/access-requests",
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"idempotency-key": "agentic-request-key",
						"x-now": "2026-07-17T08:00:00.000Z",
						"x-signmos-debug": "agentic-access-link",
					},
					body: JSON.stringify({
						email: " Agent.User@Example.COM ",
						turnstileToken: "test-pass",
					}),
				},
				{
					APP_BASE_URL: "http://localhost",
					CLOUDFLARE_ENV: "test",
					TURNSTILE_TEST_BYPASS: "true",
				},
			);

		const first = await request();
		expect(first.status).toBe(202);
		const body = (await first.json()) as {
			data: { status: string; debug: { accessUrl: string } };
		};
		expect(body.data.status).toBe("accepted");
		const accessUrl = new URL(body.data.debug.accessUrl);
		expect(accessUrl.pathname).toBe("/agentic-access");
		expect(accessUrl.hash).toMatch(/^#.+/);
		const rawCredential = decodeURIComponent(accessUrl.hash.slice(1));

		expect(state.requests).toHaveLength(1);
		expect(state.links).toEqual([
			expect.objectContaining({
				email: "agent.user@example.com",
				credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "active",
				expiresAt: new Date("2026-07-17T08:30:00.000Z"),
			}),
		]);
		expect(state.emails).toEqual([
			expect.objectContaining({
				email: "agent.user@example.com",
				kind: "agentic_access",
				deliveryStatus: "accepted",
			}),
		]);
		expect(state.events).toEqual([
			expect.objectContaining({
				email: "agent.user@example.com",
				eventType: "agentic.link.issued",
			}),
		]);
		expect(JSON.stringify([state.links, state.requests, state.emails, state.events])).not.toContain(
			rawCredential,
		);

		const replay = await request();
		expect(replay.status).toBe(202);
		await expect(replay.json()).resolves.toEqual({ data: { status: "accepted" } });
		expect(state.requests).toHaveLength(1);
		expect(state.links).toHaveLength(1);
	});

	it("never exposes the verification link through the production debug header", async () => {
		const turnstileFetch = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		vi.stubGlobal("fetch", turnstileFetch);
		const response = await apiHono.request(
			"/api/agentic/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "production-agentic-request",
					"x-signmos-debug": "agentic-access-link",
				},
				body: JSON.stringify({
					email: "agent@example.com",
					turnstileToken: "production-proof",
				}),
			},
			{
				CLOUDFLARE_ENV: "production",
				TURNSTILE_SECRET_KEY: "turnstile-secret",
			},
		);

		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toEqual({ data: { status: "accepted" } });
		expect(turnstileFetch).toHaveBeenCalledTimes(1);
		expect(state.links).toEqual([
			expect.objectContaining({ credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
		]);
	});

	it("agentic onboarding integration smoke and agent credential redaction complete the full tracer", async () => {
		const requested = await apiHono.request(
			"/api/agentic/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "agentic-smoke-request",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "agentic-access-link",
				},
				body: JSON.stringify({ email: " Agent@Example.COM ", turnstileToken: "test-pass" }),
			},
			{
				APP_BASE_URL: "http://localhost",
				CLOUDFLARE_ENV: "test",
				TURNSTILE_TEST_BYPASS: "true",
			},
		);
		const requestBody = (await requested.json()) as {
			data: { debug: { accessUrl: string } };
		};
		const rawLink = decodeURIComponent(new URL(requestBody.data.debug.accessUrl).hash.slice(1));

		const inspected = await apiHono.request("/api/agentic/access-links/inspect", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": "2026-07-17T08:05:00.000Z",
			},
			body: JSON.stringify({ credential: rawLink }),
		});
		expect(inspected.status).toBe(200);
		const redeemed = await apiHono.request("/api/agentic/access-links/redeem", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": "2026-07-17T08:05:00.000Z",
			},
			body: JSON.stringify({ credential: rawLink }),
		});
		expect(redeemed.status).toBe(201);
		const cookie = (redeemed.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
		const rawSession = cookie.split("=")[1] ?? "";

		const generated = await apiHono.request("/api/agentic/tokens", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie,
				origin: "http://localhost",
				"x-now": "2026-07-17T08:10:00.000Z",
			},
			body: JSON.stringify({ name: "Smoke agent", acknowledgeFullAuthority: true }),
		});
		expect(generated.status).toBe(201);
		const generationBody = (await generated.json()) as { data: { secret: string } };

		const identity = await apiHono.request("/api/v1/me", {
			headers: {
				authorization: `Bearer ${generationBody.data.secret}`,
				"x-now": "2026-07-17T08:11:00.000Z",
			},
		});
		expect(identity.status).toBe(200);
		await expect(identity.json()).resolves.toEqual({
			data: {
				principal: { email: "agent@example.com", actorType: "agent" },
				token: expect.objectContaining({ name: "Smoke agent" }),
			},
		});
		expect(state.events.map((event) => event.eventType)).toEqual([
			"agentic.link.issued",
			"agentic.link.redeemed",
			"agentic.token.created",
			"agentic.identity.read",
		]);
		expect(JSON.stringify([state.links, state.sessions, state.tokens, state.events])).not.toContain(
			rawLink,
		);
		expect(JSON.stringify([state.links, state.sessions, state.tokens, state.events])).not.toContain(
			rawSession,
		);
		expect(JSON.stringify([state.links, state.sessions, state.tokens, state.events])).not.toContain(
			generationBody.data.secret,
		);
	});
});
