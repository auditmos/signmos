import { envelopeRecipients, envelopes } from "@/db/envelope";
import { apiHono } from "@/hono/api";
import { normalizeHistoryEmail, requestHistoryAccess } from "./request";
import {
	historyAccessLinks,
	historyAccessRequests,
	historyEmailRecords,
	historySecurityEvents,
} from "./table";

type StoredRow = Record<string, unknown>;
type QueryDescriptor = { execute: () => Promise<StoredRow[]> };

function findLastRow(
	rows: StoredRow[],
	predicate: (row: StoredRow) => boolean,
): StoredRow | undefined {
	return [...rows].reverse().find(predicate);
}

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	envelopes: [] as StoredRow[],
	recipients: [] as StoredRow[],
	links: [] as StoredRow[],
	requests: [] as StoredRow[],
	emails: [] as StoredRow[],
	events: [] as StoredRow[],
	insertedLinkStatuses: [] as string[],
	matchEvaluations: 0,
}));

function rowsFor(table: unknown): StoredRow[] {
	if (table === state.tables.get("envelopes")) {
		state.matchEvaluations += 1;
		return state.envelopes;
	}
	if (table === state.tables.get("recipients")) return state.recipients;
	if (table === state.tables.get("links")) return state.links;
	if (table === state.tables.get("requests")) return state.requests;
	if (table === state.tables.get("emails")) return state.emails;
	if (table === state.tables.get("events")) return state.events;
	return [];
}

function insertRows(table: unknown, input: StoredRow[], ignoreConflict = false): StoredRow[] {
	const target = rowsFor(table);
	if (
		ignoreConflict &&
		table === state.tables.get("requests") &&
		input.some((row) =>
			state.requests.some((stored) => stored.idempotencyKey === row.idempotencyKey),
		)
	) {
		return [];
	}
	if (table === state.tables.get("links")) {
		state.insertedLinkStatuses.push(...input.map((row) => String(row.status)));
	}
	const inserted = input.map((row, index) => ({
		id: `10000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

function updateRows(table: unknown, values: StoredRow): StoredRow[] {
	if (table === state.tables.get("requests")) {
		const request = findLastRow(state.requests, (row) => row.linkId == null);
		if (!request) return [];
		Object.assign(request, values);
		return [request];
	}
	if (table !== state.tables.get("links")) return [];
	const status = String(values.status);
	const link =
		status === "active"
			? findLastRow(state.links, (row) => row.status === "pending")
			: state.links.find(
					(row) =>
						(row.status === "active" || row.status === "pending") &&
						row !== findLastRow(state.links, (candidate) => candidate.status === "pending"),
				);
	if (!link) return [];
	Object.assign(link, values);
	return [link];
}

function descriptor(run: () => StoredRow[]): QueryDescriptor & {
	returning: () => Promise<StoredRow[]>;
} {
	return {
		execute: async () => run(),
		returning: async () => run(),
	};
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({ limit: async () => rowsFor(table) }),
				limit: async () => rowsFor(table),
			}),
		}),
		insert: (table: unknown) => ({
			values: (rows: StoredRow | StoredRow[]) => {
				const input = Array.isArray(rows) ? rows : [rows];
				const base = descriptor(() => insertRows(table, input));
				return Object.assign(base, {
					onConflictDoNothing: () => descriptor(() => insertRows(table, input, true)),
				});
			},
		}),
		update: (table: unknown) => ({
			set: (values: StoredRow) => ({ where: () => descriptor(() => updateRows(table, values)) }),
		}),
		batch: async (queries: QueryDescriptor[]) =>
			Promise.all(queries.map((query) => query.execute())),
	}),
}));

function deliveryOptions(fetcher: typeof fetch) {
	return {
		baseUrl: "http://localhost",
		fetcher,
		env: {
			RESEND_API_KEY: "resend-key",
			RESEND_FROM_EMAIL: "Signmos <sign@example.com>",
			RESEND_REPLY_TO_EMAIL: "help@example.com",
		},
	};
}

function requestOptions(input: { key: string; fetcher: typeof fetch; now?: Date }) {
	return {
		emailDelivery: deliveryOptions(input.fetcher),
		idempotencyKey: input.key,
		requestIp: "203.0.113.10",
		now: input.now ?? new Date("2026-07-17T08:00:00.000Z"),
	};
}

describe("history access request lifecycle", () => {
	beforeEach(() => {
		state.tables = new Map<string, unknown>([
			["envelopes", envelopes],
			["recipients", envelopeRecipients],
			["links", historyAccessLinks],
			["requests", historyAccessRequests],
			["emails", historyEmailRecords],
			["events", historySecurityEvents],
		]);
		state.envelopes = [
			{
				id: "00000000-0000-4000-8000-000000000001",
				status: "completed",
				createdBy: "owner@example.com",
				createdAt: new Date("2026-07-16T08:00:00.000Z"),
			},
		];
		state.recipients = [];
		state.links = [];
		state.requests = [];
		state.emails = [];
		state.events = [];
		state.insertedLinkStatuses = [];
		state.matchEvaluations = 0;
	});

	it("makes retry idempotent and activates a fresh replacement before revoking the older link", async () => {
		state.links.push({
			id: "10000000-0000-4000-8000-000000000099",
			email: "owner@example.com",
			credentialHash: "b".repeat(64),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});
		const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
		const options = requestOptions({ key: "request-key-1", fetcher });

		const first = await requestHistoryAccess(" Owner@Example.COM ", options);
		const retry = await requestHistoryAccess("owner@example.com", options);

		expect(first.status).toBe("accepted");
		expect(first.accessUrl).toContain("/history-access/");
		expect(retry).toEqual({ status: "accepted", accessUrl: null });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(state.requests).toHaveLength(1);
		expect(state.emails).toHaveLength(1);
		expect(state.matchEvaluations).toBe(1);
		expect(state.insertedLinkStatuses).toEqual(["pending"]);
		expect(state.links.map((link) => link.status)).toEqual(["revoked", "active"]);
		expect(state.events.map((event) => event.eventType)).toEqual([
			"history.link.issued",
			"history.link.revoked",
		]);

		await requestHistoryAccess(
			"owner@example.com",
			requestOptions({ key: "request-key-2", fetcher }),
		);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(state.requests).toHaveLength(2);
		expect(state.insertedLinkStatuses).toEqual(["pending", "pending"]);
		expect(state.links.map((link) => link.status)).toEqual(["revoked", "revoked", "active"]);
	});

	it("records provider failure without leaking or revoking the older usable link", async () => {
		state.links.push({
			id: "10000000-0000-4000-8000-000000000099",
			email: "owner@example.com",
			credentialHash: "b".repeat(64),
			status: "active",
			expiresAt: new Date("2026-07-17T08:30:00.000Z"),
		});
		let attemptedPayload = "";
		const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
			attemptedPayload = String(init?.body ?? "");
			return new Response("provider rejected", { status: 503 });
		});

		const result = await requestHistoryAccess(
			"owner@example.com",
			requestOptions({ key: "failed-key", fetcher }),
		);
		const rawCredential = attemptedPayload.match(/history-access\\?\/(.+?)(?:\\n|<)/)?.[1] ?? "";

		expect(result).toEqual({ status: "accepted", accessUrl: null });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(state.links.map((link) => link.status)).toEqual(["active", "pending"]);
		expect(state.emails).toEqual([
			expect.objectContaining({
				deliveryStatus: "failed",
				providerMessage: "Email provider rejected the message (503)",
			}),
		]);
		expect(JSON.stringify([state.links, state.requests, state.emails, state.events])).not.toContain(
			rawCredential,
		);
		expect(state.events.map((event) => event.eventType)).toEqual(["history.link.issued"]);
	});

	it("does not issue or send for unmatched and deleted-only identities", async () => {
		const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
		const unmatched = await requestHistoryAccess(
			"nobody@example.com",
			requestOptions({ key: "unmatched-key", fetcher }),
		);
		state.envelopes[0] = { ...state.envelopes[0], status: "deleted" };
		const deletedOnly = await requestHistoryAccess(
			"owner@example.com",
			requestOptions({ key: "deleted-key", fetcher }),
		);

		expect(unmatched).toEqual({ status: "accepted", accessUrl: null });
		expect(deletedOnly).toEqual(unmatched);
		expect(fetcher).not.toHaveBeenCalled();
		expect(state.links).toEqual([]);
		expect(state.emails).toEqual([]);
		expect(state.requests).toHaveLength(2);
	});

	it("returns identical public bodies for matching, unmatched, and deleted-only requests", async () => {
		const bodies: unknown[] = [];
		for (const [email, key, deleted] of [
			["owner@example.com", "matching-key", false],
			["nobody@example.com", "unmatched-key", false],
			["owner@example.com", "deleted-key", true],
		] as const) {
			state.envelopes[0] = { ...state.envelopes[0], status: deleted ? "deleted" : "completed" };
			const response = await apiHono.request(
				"/api/history/access-requests",
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"idempotency-key": key,
						"cf-connecting-ip": `203.0.113.${bodies.length + 20}`,
					},
					body: JSON.stringify({ email, turnstileToken: "test-pass" }),
				},
				{ CLOUDFLARE_ENV: "test", TURNSTILE_TEST_BYPASS: "true" },
			);
			expect(response.status).toBe(202);
			bodies.push(await response.json());
		}

		expect(bodies).toEqual([
			{ data: { status: "accepted" } },
			{ data: { status: "accepted" } },
			{ data: { status: "accepted" } },
		]);
		expect(JSON.stringify(bodies)).not.toMatch(/match|count|delivery/i);
	});

	it("normalizes whitespace/case while preserving dot and plus aliases", async () => {
		expect(normalizeHistoryEmail(" Owner.Name+Pilot@Example.COM ")).toBe(
			"owner.name+pilot@example.com",
		);
		expect(normalizeHistoryEmail("ownername+pilot@example.com")).not.toBe(
			"owner.name+pilot@example.com",
		);
		expect(normalizeHistoryEmail("owner.name@example.com")).not.toBe(
			"owner.name+pilot@example.com",
		);
		state.envelopes[0] = {
			...state.envelopes[0],
			createdBy: "owner.name+pilot@example.com",
		};
		const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
		for (const [email, key] of [
			[" Owner.Name+Pilot@Example.COM ", "exact-alias"],
			["ownername+pilot@example.com", "dot-variant"],
			["owner.name@example.com", "plus-variant"],
		] as const) {
			await requestHistoryAccess(email, requestOptions({ key, fetcher }));
		}
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(state.links).toHaveLength(1);
		expect(state.links[0]?.email).toBe("owner.name+pilot@example.com");
	});

	it("keeps raw debug credentials out of a valid production response", async () => {
		const turnstileFetch = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		vi.stubGlobal("fetch", turnstileFetch);
		const response = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "production-request",
					"cf-connecting-ip": "203.0.113.40",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({
					email: "owner@example.com",
					turnstileToken: "production-proof",
				}),
			},
			{ CLOUDFLARE_ENV: "production", TURNSTILE_SECRET_KEY: "turnstile-secret" },
		);

		expect(response.status).toBe(202);
		const body = await response.json();
		expect(body).toEqual({ data: { status: "accepted" } });
		expect(JSON.stringify(body)).not.toContain("/history-access/");
		expect(turnstileFetch).toHaveBeenCalledTimes(1);
		expect(state.links).toEqual([
			expect.objectContaining({
				credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "active",
			}),
		]);
	});
});
