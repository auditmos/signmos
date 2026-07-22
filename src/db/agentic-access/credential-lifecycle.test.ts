import { apiHono } from "@/hono/api";
import {
	createAgenticManagementSessionFromVerifiedIdentity,
	inspectAgenticAccessLink,
	redeemAgenticAccessLink,
	resolveAgenticManagementSession,
} from "./credential-authority";
import { hashAgenticCredential } from "./request";
import { agenticAccessLinks, agenticManagementSessions, agenticSecurityEvents } from "./table";

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

function insertRows(table: unknown, rows: StoredRow[]): StoredRow[] {
	const target = rowsFor(table);
	const inserted = rows.map((row, index) => ({
		id: `b0000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

function updateRows(table: unknown, values: StoredRow): StoredRow[] {
	const target = rowsFor(table);
	const status = String(values.status);
	const boundary =
		values.consumedAt instanceof Date
			? values.consumedAt
			: values.expiresAt instanceof Date
				? values.expiresAt
				: null;
	const row = target.find((candidate) => {
		if (candidate.status !== "active") return false;
		if (status === "consumed" && boundary && candidate.expiresAt instanceof Date) {
			return candidate.expiresAt > boundary;
		}
		return true;
	});
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

describe("agentic onboarding credential lifecycle", () => {
	beforeEach(() => {
		state.tables = new Map<string, unknown>([
			["links", agenticAccessLinks],
			["sessions", agenticManagementSessions],
			["events", agenticSecurityEvents],
		]);
		state.links = [];
		state.sessions = [];
		state.events = [];
	});

	it("bridges a verified product identity into a separate short Agentic session", async () => {
		// Cross-mode identity assumptions before RED:
		// - A verified My Documents identity may open Agentic mode without another email.
		// - Agentic token management still receives its own fixed 15-minute session.
		// - The bridge seed and raw session are never persisted in plaintext.
		const now = new Date("2026-07-22T12:00:00.000Z");
		const result = await createAgenticManagementSessionFromVerifiedIdentity({
			email: " Owner@Example.COM ",
			now,
			requestIp: "203.0.113.10",
		});

		expect(result.expiresAt).toEqual(new Date("2026-07-22T12:15:00.000Z"));
		expect(state.links).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "consumed",
			}),
		]);
		expect(state.sessions).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				status: "active",
				expiresAt: new Date("2026-07-22T12:15:00.000Z"),
			}),
		]);
		expect(state.events).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				eventType: "agentic.session.bridged",
				requestIp: "203.0.113.10",
			}),
		]);
		expect(JSON.stringify([state.links, state.sessions, state.events])).not.toContain(
			result.rawSession,
		);
	});

	it("is scanner-safe and atomically redeems exactly once before 30 minutes", async () => {
		// Issue #44 time-boundary assumptions before RED:
		// - Inspection never consumes an active credential.
		// - The link is valid strictly before expiresAt and expired at the exact boundary.
		// - Competing redemptions rely on one conditional database update, not process memory.
		// - A successful redemption creates exactly one separate 15-minute session.
		const rawLink = "raw-agentic-link";
		state.links.push({
			id: "10000000-0000-4000-8000-000000000001",
			email: "agent@example.com",
			credentialHash: await hashAgenticCredential(rawLink),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});

		for (let read = 0; read < 2; read += 1) {
			await expect(
				inspectAgenticAccessLink(rawLink, new Date("2026-07-17T08:29:59.999Z")),
			).resolves.toEqual({ state: "confirm", expiresAt: "2026-07-17T08:30:00.000Z" });
		}
		expect(state.links[0]?.status).toBe("active");

		const results = await Promise.all([
			redeemAgenticAccessLink(rawLink, new Date("2026-07-17T08:29:59.999Z")),
			redeemAgenticAccessLink(rawLink, new Date("2026-07-17T08:29:59.999Z")),
		]);
		expect(results.filter((result) => result.status === "authenticated")).toHaveLength(1);
		expect(results.filter((result) => result.status === "consumed")).toHaveLength(1);
		expect(state.sessions).toHaveLength(1);
		expect(state.sessions[0]).toEqual(
			expect.objectContaining({
				email: "agent@example.com",
				status: "active",
				expiresAt: new Date("2026-07-17T08:44:59.999Z"),
			}),
		);
		expect(state.events).toEqual([
			expect.objectContaining({
				eventType: "agentic.link.redeemed",
				email: "agent@example.com",
			}),
		]);
		expect(JSON.stringify([state.links, state.sessions, state.events])).not.toContain(rawLink);
	});

	it("expires the link and management session at their exact boundaries", async () => {
		const rawLink = "raw-expiring-agentic-link";
		state.links.push({
			id: "10000000-0000-4000-8000-000000000001",
			email: "agent@example.com",
			credentialHash: await hashAgenticCredential(rawLink),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});
		await expect(
			redeemAgenticAccessLink(rawLink, new Date("2026-07-17T08:30:00.000Z")),
		).resolves.toEqual({ status: "expired" });
		expect(state.sessions).toEqual([]);

		const rawSession = "raw-agentic-management-session";
		state.sessions.push({
			id: "20000000-0000-4000-8000-000000000001",
			linkId: "10000000-0000-4000-8000-000000000001",
			email: "agent@example.com",
			sessionHash: await hashAgenticCredential(rawSession),
			status: "active",
			expiresAt: new Date("2026-07-17T08:15:00.000Z"),
		});
		await expect(
			resolveAgenticManagementSession(rawSession, new Date("2026-07-17T08:14:59.999Z")),
		).resolves.toEqual({
			state: "active",
			session: expect.objectContaining({ email: "agent@example.com" }),
		});
		await expect(
			resolveAgenticManagementSession(rawSession, new Date("2026-07-17T08:15:00.000Z")),
		).resolves.toEqual({ state: "expired" });
	});

	it("requires explicit same-origin redemption and issues an isolated secure cookie", async () => {
		const rawLink = "raw-route-agentic-link";
		state.links.push({
			id: "10000000-0000-4000-8000-000000000001",
			email: "agent@example.com",
			credentialHash: await hashAgenticCredential(rawLink),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});

		const inspection = await apiHono.request("/api/agentic/access-links/inspect", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": "2026-07-17T08:10:00.000Z",
			},
			body: JSON.stringify({ credential: rawLink }),
		});
		expect(inspection.status).toBe(200);
		expect(inspection.headers.get("referrer-policy")).toBe("no-referrer");
		expect(state.links[0]?.status).toBe("active");

		const crossOrigin = await apiHono.request("/api/agentic/access-links/redeem", {
			method: "POST",
			headers: { "content-type": "application/json", origin: "https://attacker.example" },
			body: JSON.stringify({ credential: rawLink }),
		});
		expect(crossOrigin.status).toBe(403);
		expect(state.sessions).toEqual([]);

		const redeemed = await apiHono.request("/api/agentic/access-links/redeem", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": "2026-07-17T08:10:00.000Z",
			},
			body: JSON.stringify({ credential: rawLink }),
		});
		expect(redeemed.status).toBe(201);
		await expect(redeemed.json()).resolves.toEqual({
			data: { status: "authenticated", redirectUrl: "/agentic-console" },
		});
		const cookie = redeemed.headers.get("set-cookie") ?? "";
		expect(cookie).toMatch(/signmos_agentic_management=/);
		expect(cookie).toMatch(/HttpOnly/i);
		expect(cookie).toMatch(/Secure/i);
		expect(cookie).toMatch(/SameSite=Lax/i);
		expect(cookie).toMatch(/Max-Age=900/i);

		const historyAccess = await apiHono.request("/api/history/documents", {
			headers: { cookie },
		});
		expect(historyAccess.status).toBe(401);
	});
});
