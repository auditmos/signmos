import { apiHono } from "@/hono/api";
import {
	createHistorySessionFromVerifiedIdentity,
	inspectHistoryAccessLink,
	redeemHistoryAccessLink,
	resolveHistorySessionState,
	revokeHistorySession,
} from "./credential-authority";
import { hashHistoryCredential } from "./request";
import { historyAccessLinks, historySecurityEvents, historySessions } from "./table";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	links: [] as StoredRow[],
	sessions: [] as StoredRow[],
	events: [] as StoredRow[],
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("links")) return state.links;
	if (table === state.tables.get("sessions")) return state.sessions;
	if (table === state.tables.get("events")) return state.events;
	return [];
}

function insertRows(table: unknown, input: StoredRow[]): StoredRow[] {
	const target = rowsFor(table);
	const rows = input.map((row, index) => ({
		id: `50000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...rows);
	return rows;
}

function updateRows(table: unknown, values: StoredRow): StoredRow[] {
	const target = rowsFor(table);
	const row = target.find((candidate) => candidate.status === "active");
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
			values: (rows: StoredRow | StoredRow[]) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (values: StoredRow) => ({
				where: () => ({ returning: async () => updateRows(table, values) }),
			}),
		}),
	}),
}));

describe("history credential and session security lifecycle", () => {
	beforeEach(() => {
		state.tables = new Map<string, unknown>([
			["links", historyAccessLinks],
			["sessions", historySessions],
			["events", historySecurityEvents],
		]);
		state.links = [];
		state.sessions = [];
		state.events = [];
	});

	it("bridges a verified Agentic identity without extending its shorter expiry", async () => {
		// Reverse-bridge assumptions before RED:
		// - Agentic email verification may open signing and document modes without another email.
		// - The new history session cannot outlive the source Agentic management session.
		// - Raw bridge and session credentials remain absent from persistence and audit rows.
		const result = await createHistorySessionFromVerifiedIdentity({
			email: " Agent@Example.COM ",
			verifiedUntil: new Date("2026-07-22T12:10:00.000Z"),
			now: new Date("2026-07-22T12:00:00.000Z"),
			requestIp: "203.0.113.11",
		});

		expect(result.expiresAt).toEqual(new Date("2026-07-22T12:10:00.000Z"));
		expect(state.links).toEqual([
			expect.objectContaining({
				email: "agent@example.com",
				credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "consumed",
			}),
		]);
		expect(state.sessions).toEqual([
			expect.objectContaining({
				email: "agent@example.com",
				status: "active",
				expiresAt: new Date("2026-07-22T12:10:00.000Z"),
			}),
		]);
		expect(state.events).toEqual([
			expect.objectContaining({
				email: "agent@example.com",
				eventType: "history.session.bridged",
				requestIp: "203.0.113.11",
			}),
		]);
		expect(JSON.stringify([state.links, state.sessions, state.events])).not.toContain(
			result.rawSession,
		);
	});

	it("observes link expiry once and records no raw credential", async () => {
		// Issue #38 assumptions before RED:
		// - Expiry is terminal at the exact boundary and persisted on first observation.
		// - Repeated scanner reads do not duplicate the expiry event.
		// - Security rows identify stored records, never the presented raw credential.
		const rawLink = "raw-expiring-history-link";
		state.links.push({
			id: "10000000-0000-4000-8000-000000000001",
			email: "owner@example.com",
			credentialHash: await hashHistoryCredential(rawLink),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});

		for (let read = 0; read < 2; read += 1) {
			await expect(
				inspectHistoryAccessLink(rawLink, new Date("2026-07-17T08:30:00.000Z")),
			).resolves.toEqual({ state: "expired" });
		}
		expect(state.links[0]?.status).toBe("expired");
		expect(state.events).toEqual([
			expect.objectContaining({
				linkId: "10000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				eventType: "history.link.expired",
			}),
		]);
		expect(JSON.stringify(state.events)).not.toContain(rawLink);
	});

	it("records successful redemption with safe link and session references", async () => {
		const rawLink = "raw-redeemable-history-link";
		state.links.push({
			id: "10000000-0000-4000-8000-000000000001",
			email: "owner@example.com",
			credentialHash: await hashHistoryCredential(rawLink),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});

		const result = await redeemHistoryAccessLink(
			rawLink,
			new Date("2026-07-17T08:29:59.000Z"),
			"203.0.113.10",
		);

		expect(result.status).toBe("authenticated");
		expect(state.sessions).toHaveLength(1);
		expect(state.events).toEqual([
			expect.objectContaining({
				linkId: "10000000-0000-4000-8000-000000000001",
				sessionId: state.sessions[0]?.id,
				eventType: "history.link.redeemed",
				requestIp: "203.0.113.10",
			}),
		]);
		expect(JSON.stringify(state.events)).not.toContain(rawLink);
		if (result.status === "authenticated") {
			expect(JSON.stringify(state.events)).not.toContain(result.rawSession);
		}
	});

	it("observes session expiry once and exposes a recovery-specific state", async () => {
		const rawSession = "raw-expiring-history-session";
		state.sessions.push({
			id: "50000000-0000-4000-8000-000000000001",
			linkId: "10000000-0000-4000-8000-000000000001",
			email: "owner@example.com",
			sessionHash: await hashHistoryCredential(rawSession),
			status: "active",
			expiresAt: new Date("2026-07-17T16:00:00.000Z"),
		});

		await expect(
			resolveHistorySessionState(rawSession, new Date("2026-07-17T16:00:00.000Z")),
		).resolves.toEqual({ state: "expired" });
		expect(state.sessions[0]?.status).toBe("expired");
		expect(state.events).toEqual([
			expect.objectContaining({
				sessionId: "50000000-0000-4000-8000-000000000001",
				eventType: "history.session.expired",
			}),
		]);
	});

	it("revokes only the presented current session and records revocation", async () => {
		const currentRawSession = "raw-current-history-session";
		state.sessions.push(
			{
				id: "50000000-0000-4000-8000-000000000001",
				linkId: "10000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				sessionHash: await hashHistoryCredential(currentRawSession),
				status: "active",
				expiresAt: new Date("2026-07-17T16:00:00.000Z"),
			},
			{
				id: "50000000-0000-4000-8000-000000000002",
				linkId: "10000000-0000-4000-8000-000000000002",
				email: "owner@example.com",
				sessionHash: await hashHistoryCredential("raw-other-history-session"),
				status: "active",
				expiresAt: new Date("2026-07-17T16:00:00.000Z"),
			},
		);

		await expect(
			revokeHistorySession(currentRawSession, new Date("2026-07-17T09:00:00.000Z"), "203.0.113.10"),
		).resolves.toBe(true);
		expect(state.sessions.map((session) => session.status)).toEqual(["revoked", "active"]);
		expect(state.events).toEqual([
			expect.objectContaining({
				sessionId: "50000000-0000-4000-8000-000000000001",
				eventType: "history.session.revoked",
			}),
		]);
		expect(JSON.stringify(state.events)).not.toContain(currentRawSession);
	});

	it("requires same-origin sign-out, clears the cookie, and leaves other sessions active", async () => {
		const currentRawSession = "raw-current-history-session";
		state.sessions.push(
			{
				id: "50000000-0000-4000-8000-000000000001",
				linkId: "10000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				sessionHash: await hashHistoryCredential(currentRawSession),
				status: "active",
				expiresAt: new Date("2026-07-17T16:00:00.000Z"),
			},
			{
				id: "50000000-0000-4000-8000-000000000002",
				linkId: "10000000-0000-4000-8000-000000000002",
				email: "owner@example.com",
				sessionHash: await hashHistoryCredential("raw-other-history-session"),
				status: "active",
				expiresAt: new Date("2026-07-17T16:00:00.000Z"),
			},
		);
		const request = (origin: string) =>
			apiHono.request("/api/history/session/sign-out", {
				method: "POST",
				headers: {
					cookie: `signmos_history_session=${currentRawSession}`,
					origin,
					"x-now": "2026-07-17T09:00:00.000Z",
				},
			});

		const crossOrigin = await request("https://attacker.example");
		expect(crossOrigin.status).toBe(403);
		expect(state.sessions.map((session) => session.status)).toEqual(["active", "active"]);

		const signedOut = await request("http://localhost");
		expect(signedOut.status).toBe(204);
		expect(signedOut.headers.get("set-cookie")).toMatch(/signmos_history_session=;.*Max-Age=0/i);
		expect(state.sessions.map((session) => session.status)).toEqual(["revoked", "active"]);
		expect(state.events).toEqual([
			expect.objectContaining({ eventType: "history.session.revoked" }),
		]);
	});

	it("returns request-new-link recovery for an expired session", async () => {
		const rawSession = "raw-expired-history-session";
		state.sessions.push({
			id: "50000000-0000-4000-8000-000000000001",
			linkId: "10000000-0000-4000-8000-000000000001",
			email: "owner@example.com",
			sessionHash: await hashHistoryCredential(rawSession),
			status: "active",
			expiresAt: new Date("2026-07-17T16:00:00.000Z"),
		});

		const response = await apiHono.request("/api/history/documents", {
			headers: {
				cookie: `signmos_history_session=${rawSession}`,
				"x-now": "2026-07-17T16:00:00.000Z",
			},
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "HISTORY_SESSION_EXPIRED",
				message: "Your My documents session expired",
				recoveryUrl: "/?task=my-documents",
			},
		});
	});
});
