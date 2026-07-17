import {
	auditEvents,
	envelopes,
	idempotencyRecords,
	senderVerificationEmailRecords,
	senderVerificationTokens,
} from "@/db/envelope";
import { hashHistoryCredential, historySecurityEvents, historySessions } from "@/db/history-access";
import { apiHono } from "@/hono/api";

type StoredRow = Record<string, unknown>;

const rawSession = "active-history-session";
const now = "2026-07-18T08:00:00.000Z";

const state = vi.hoisted(() => ({
	rows: new Map<unknown, StoredRow[]>(),
	nextId: 1,
}));

function rowsFor(table: unknown): StoredRow[] {
	return state.rows.get(table) ?? [];
}

function selectQuery(table: unknown) {
	const load = async () => rowsFor(table);
	return Object.assign(load(), { where: () => ({ limit: load }), limit: load });
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({ from: (table: unknown) => selectQuery(table) }),
		insert: (table: unknown) => ({
			values: (values: StoredRow | StoredRow[]) => ({
				returning: async () => {
					const inserted = (Array.isArray(values) ? values : [values]).map((value) => ({
						id: `90000000-0000-4000-8000-${String(state.nextId++).padStart(12, "0")}`,
						createdAt: new Date(now),
						...value,
					}));
					rowsFor(table).push(...inserted);
					return inserted;
				},
			}),
		}),
	}),
}));

function tableRows(table: unknown): StoredRow[] {
	return rowsFor(table);
}

describe("history-session envelope start", () => {
	beforeEach(async () => {
		state.rows = new Map<unknown, StoredRow[]>([
			[envelopes, []],
			[idempotencyRecords, []],
			[auditEvents, []],
			[senderVerificationTokens, []],
			[senderVerificationEmailRecords, []],
			[historySessions, []],
			[historySecurityEvents, []],
		]);
		state.nextId = 1;
		tableRows(historySessions).push({
			id: "40000000-0000-4000-8000-000000000043",
			linkId: "10000000-0000-4000-8000-000000000043",
			email: "owner@example.com",
			sessionHash: await hashHistoryCredential(rawSession),
			status: "active",
			expiresAt: new Date("2026-07-18T16:00:00.000Z"),
			createdAt: new Date("2026-07-18T07:00:00.000Z"),
		});
	});

	function startRequest(input?: {
		name?: string;
		signingMode?: string;
		idempotencyKey?: string;
		origin?: string;
		cookie?: string;
	}) {
		return apiHono.request("/api/history/envelopes", {
			method: "POST",
			headers: {
				cookie: input?.cookie ?? `signmos_history_session=${rawSession}`,
				"content-type": "application/json",
				"idempotency-key": input?.idempotencyKey ?? "history-start-key",
				origin: input?.origin ?? "http://localhost",
				"x-now": now,
			},
			body: JSON.stringify({
				name: input?.name ?? "Ada Lovelace",
				signingMode: input?.signingMode ?? "only_me",
			}),
		});
	}

	it("creates an already-verified draft without issuing or emailing another credential", async () => {
		// Approved assumptions before RED:
		// - Input is same-origin, idempotent, and authenticated only by the active history cookie.
		// - Name is editable/trimmed; email comes only from the session; both signing modes are valid.
		// - Output is a draft plus a history-session preparation URL, with no sender token or email.
		// - Invalid input/session/origin and replay are separate incremental slices.
		const response = await apiHono.request("/api/history/envelopes", {
			method: "POST",
			headers: {
				cookie: `signmos_history_session=${rawSession}`,
				"content-type": "application/json",
				"idempotency-key": "history-start-key",
				origin: "http://localhost",
				"x-now": now,
			},
			body: JSON.stringify({ name: "  Ada Lovelace  ", signingMode: "only_me" }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toEqual({
			data: {
				envelopeId: expect.any(String),
				status: "draft",
				signingMode: "only_me",
				sender: { name: "Ada Lovelace", email: "owner@example.com" },
				redirectUrl: expect.stringMatching(/^\/my-documents\/[^/]+\/manage$/),
			},
		});
		expect(tableRows(envelopes)).toEqual([
			expect.objectContaining({
				status: "draft",
				signingMode: "only_me",
				createdBy: "owner@example.com",
				createdByName: "Ada Lovelace",
			}),
		]);
		expect(tableRows(senderVerificationTokens)).toEqual([]);
		expect(tableRows(senderVerificationEmailRecords)).toEqual([]);
		expect(tableRows(auditEvents)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventType: "sender.start.created" }),
				expect.objectContaining({ eventType: "sender.verified" }),
			]),
		);
		expect(tableRows(auditEvents)).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ eventType: "sender.verification.sent" })]),
		);
		expect(tableRows(historySecurityEvents)).toEqual([
			expect.objectContaining({
				envelopeId: tableRows(envelopes)[0]?.id,
				sessionId: tableRows(historySessions)[0]?.id,
				email: "owner@example.com",
				eventType: "history.creator.started",
			}),
		]);
		expect(JSON.stringify(body)).not.toMatch(/(?:token|credential|verificationUrl)/i);
	});

	it("replays one idempotency key without duplicating drafts or audit events", async () => {
		const first = await startRequest();
		const second = await startRequest({
			name: "A different retry payload",
			signingMode: "me_and_another_signer",
		});

		expect([first.status, second.status]).toEqual([201, 200]);
		await expect(second.json()).resolves.toEqual({
			data: expect.objectContaining({
				envelopeId: tableRows(envelopes)[0]?.id,
				signingMode: "only_me",
				sender: { name: "Ada Lovelace", email: "owner@example.com" },
			}),
		});
		expect(tableRows(envelopes)).toHaveLength(1);
		expect(tableRows(idempotencyRecords)).toHaveLength(1);
		expect(tableRows(auditEvents)).toHaveLength(2);
		expect(tableRows(historySecurityEvents)).toHaveLength(1);
	});

	it.each([
		["missing session", { cookie: "" }, 401, "HISTORY_SESSION_REQUIRED"],
		["cross-origin request", { origin: "https://attacker.example" }, 403, "INVALID_ORIGIN"],
		["missing name", { name: " " }, 400, "INVALID_HISTORY_ENVELOPE_START"],
		["unsupported signing mode", { signingMode: "unknown" }, 400, "INVALID_HISTORY_ENVELOPE_START"],
	] as const)("rejects %s without creating an envelope", async (_label, input, status, code) => {
		const response = await startRequest(input);

		expect(response.status).toBe(status);
		await expect(response.json()).resolves.toEqual({
			error: expect.objectContaining({ code }),
		});
		expect(tableRows(envelopes)).toEqual([]);
	});
});
