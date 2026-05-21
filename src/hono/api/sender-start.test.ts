import {
	auditEvents,
	envelopes,
	finalDocuments,
	idempotencyRecords,
	rateLimitRecords,
	senderVerificationEmailRecords,
	senderVerificationTokens,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	idempotencyTable: null as unknown,
	senderVerificationTokensTable: null as unknown,
	senderVerificationEmailRecordsTable: null as unknown,
	rateLimitRecordsTable: null as unknown,
	auditEventsTable: null as unknown,
	finalDocumentsTable: null as unknown,
	envelopes: [] as Array<Record<string, unknown>>,
	idempotencyRecords: [] as Array<Record<string, unknown>>,
	senderVerificationTokens: [] as Array<Record<string, unknown>>,
	senderVerificationEmailRecords: [] as Array<Record<string, unknown>>,
	rateLimitRecords: [] as Array<Record<string, unknown>>,
	auditEvents: [] as Array<Record<string, unknown>>,
	finalDocuments: [] as Array<Record<string, unknown>>,
}));

function selectRows(table: unknown): Array<Record<string, unknown>> {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.idempotencyTable) return state.idempotencyRecords;
	if (table === state.senderVerificationTokensTable) return state.senderVerificationTokens;
	if (table === state.senderVerificationEmailRecordsTable)
		return state.senderVerificationEmailRecords;
	if (table === state.rateLimitRecordsTable) return state.rateLimitRecords;
	if (table === state.auditEventsTable) return state.auditEvents;
	if (table === state.finalDocumentsTable) return state.finalDocuments;
	return [];
}

function insertRows(table: unknown, rows: Array<Record<string, unknown>>) {
	if (table === state.envelopesTable) return insertWithDefaults(state.envelopes, rows, "00000000");
	if (table === state.idempotencyTable) {
		return insertWithDefaults(state.idempotencyRecords, rows, "10000000");
	}
	if (table === state.senderVerificationTokensTable) {
		return insertWithDefaults(state.senderVerificationTokens, rows, "20000000", {
			verifiedAt: null,
		});
	}
	if (table === state.senderVerificationEmailRecordsTable) {
		return insertWithDefaults(state.senderVerificationEmailRecords, rows, "30000000", {
			sentAt: new Date("2026-05-21T09:00:00.000Z"),
		});
	}
	if (table === state.rateLimitRecordsTable) {
		return insertWithDefaults(state.rateLimitRecords, rows, "40000000");
	}
	if (table === state.auditEventsTable)
		return insertWithDefaults(state.auditEvents, rows, "50000000");
	return rows;
}

function insertWithDefaults(
	target: Array<Record<string, unknown>>,
	rows: Array<Record<string, unknown>>,
	prefix: string,
	extra: Record<string, unknown> = {},
) {
	const inserted = rows.map((row, index) => ({
		id: `${prefix}-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-05-21T09:00:00.000Z"),
		updatedAt: new Date("2026-05-21T09:00:00.000Z"),
		...extra,
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

function updateRows(table: unknown, value: Record<string, unknown>) {
	if (table === state.envelopesTable) {
		state.envelopes = state.envelopes.map((row) => ({ ...row, ...value }));
	}
	if (table === state.senderVerificationTokensTable) {
		state.senderVerificationTokens = state.senderVerificationTokens.map((row) => ({
			...row,
			...value,
		}));
	}
	if (table === state.rateLimitRecordsTable) {
		state.rateLimitRecords = state.rateLimitRecords.map((row) => ({ ...row, ...value }));
	}
	return [];
}

function resetState() {
	state.envelopesTable = envelopes;
	state.idempotencyTable = idempotencyRecords;
	state.senderVerificationTokensTable = senderVerificationTokens;
	state.senderVerificationEmailRecordsTable = senderVerificationEmailRecords;
	state.rateLimitRecordsTable = rateLimitRecords;
	state.auditEventsTable = auditEvents;
	state.finalDocumentsTable = finalDocuments;
	for (const key of [
		"envelopes",
		"idempotencyRecords",
		"senderVerificationTokens",
		"senderVerificationEmailRecords",
		"rateLimitRecords",
		"auditEvents",
		"finalDocuments",
	] as const) {
		state[key].length = 0;
	}
}

function seedAwaitingVerificationEnvelope() {
	state.envelopes.push({
		id: "00000000-0000-4000-8000-000000000001",
		status: "awaiting_verification",
		createdBy: "ada@example.com",
		createdAt: new Date("2026-05-21T09:00:00.000Z"),
		sentBy: null,
		sentAt: null,
	});
	state.senderVerificationTokens.push({
		id: "20000000-0000-4000-8000-000000000001",
		envelopeId: "00000000-0000-4000-8000-000000000001",
		name: "Ada Lovelace",
		email: "ada@example.com",
		token: "sender-token",
		status: "pending",
		expiresAt: new Date("2026-05-21T09:30:00.000Z"),
		verifiedAt: null,
		createdAt: new Date("2026-05-21T09:00:00.000Z"),
	});
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({
					limit: async () => selectRows(table),
				}),
			}),
		}),
		insert: (table: unknown) => ({
			values: (rows: Array<Record<string, unknown>> | Record<string, unknown>) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (value: Record<string, unknown>) => ({
				where: async () => updateRows(table, value),
			}),
		}),
	}),
}));

describe("sender start API", () => {
	beforeEach(resetState);

	it("starts a no-account sender envelope and returns a verification fallback link", async () => {
		// Assumptions for issue #14 RED:
		// - POST /api/envelopes/sender-start is the public no-account start boundary.
		// - A test Turnstile bypass is explicit and only active through the route environment.
		// - Start creates awaiting_verification state; the magic link later moves it to draft.
		// - PDF upload, recipients, signing, final PDFs, and password accounts stay out of scope.
		const response = await apiHono.request(
			"/api/envelopes/sender-start",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "sender-start-1",
					"cf-connecting-ip": "203.0.113.10",
				},
				body: JSON.stringify({
					name: "Ada Lovelace",
					email: "ADA@EXAMPLE.COM",
					turnstileToken: "test-pass",
				}),
			},
			{ TURNSTILE_TEST_BYPASS: "true" },
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: expect.any(String),
				status: "awaiting_verification",
				sender: {
					name: "Ada Lovelace",
					email: "ada@example.com",
				},
				allowedActions: ["verify_sender_email"],
				verification: {
					email: "ada@example.com",
					expiresAt: expect.any(String),
					fallbackUrl: expect.stringContaining("/api/envelopes/sender-verifications/"),
				},
			},
		});
		expect(state.envelopes).toEqual([
			expect.objectContaining({
				status: "awaiting_verification",
				createdBy: "ada@example.com",
			}),
		]);
		expect(state.senderVerificationEmailRecords).toEqual([
			expect.objectContaining({
				email: "ada@example.com",
				kind: "sender_verification",
				fallbackUrl: expect.stringContaining("/api/envelopes/sender-verifications/"),
			}),
		]);
		expect(state.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventType: "sender.start.created" }),
				expect.objectContaining({ eventType: "sender.verification.sent" }),
			]),
		);
	});

	it("rejects missing or failed Turnstile and rate-limited IP or email attempts", async () => {
		const missingTurnstile = await apiHono.request("/api/envelopes/sender-start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }),
		});

		expect(missingTurnstile.status).toBe(400);
		await expect(missingTurnstile.json()).resolves.toEqual({
			error: {
				code: "INVALID_SENDER_START",
				message: "Sender name, email, and Turnstile token are required",
				fields: ["name", "email", "turnstileToken"],
			},
		});

		const failedTurnstile = await apiHono.request("/api/envelopes/sender-start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Ada Lovelace",
				email: "ada@example.com",
				turnstileToken: "invalid",
			}),
		});

		expect(failedTurnstile.status).toBe(403);
		await expect(failedTurnstile.json()).resolves.toEqual({
			error: {
				code: "TURNSTILE_FAILED",
				message: "Turnstile verification failed",
			},
		});

		state.rateLimitRecords.push({
			id: "40000000-0000-4000-8000-000000000001",
			key: "ip:203.0.113.10",
			operation: "sender-start",
			attempts: 5,
			resetAt: new Date("2026-05-21T09:10:00.000Z"),
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
			updatedAt: new Date("2026-05-21T09:00:00.000Z"),
		});
		const rateLimitedIp = await apiHono.request(
			"/api/envelopes/sender-start",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "203.0.113.10",
					"x-now": "2026-05-21T09:01:00.000Z",
				},
				body: JSON.stringify({
					name: "Ada Lovelace",
					email: "ada@example.com",
					turnstileToken: "test-pass",
				}),
			},
			{ TURNSTILE_TEST_BYPASS: "true" },
		);

		expect(rateLimitedIp.status).toBe(429);
		await expect(rateLimitedIp.json()).resolves.toEqual({
			error: {
				code: "RATE_LIMITED",
				message: "Too many sender start attempts",
				scope: "ip",
				resetAt: "2026-05-21T09:10:00.000Z",
			},
		});

		resetState();
		state.rateLimitRecords.push({
			id: "40000000-0000-4000-8000-000000000002",
			key: "email:ada@example.com",
			operation: "sender-start",
			attempts: 5,
			resetAt: new Date("2026-05-21T09:10:00.000Z"),
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
			updatedAt: new Date("2026-05-21T09:00:00.000Z"),
		});
		const rateLimitedEmail = await apiHono.request(
			"/api/envelopes/sender-start",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "198.51.100.10",
					"x-now": "2026-05-21T09:01:00.000Z",
				},
				body: JSON.stringify({
					name: "Ada Lovelace",
					email: "ADA@EXAMPLE.COM",
					turnstileToken: "test-pass",
				}),
			},
			{ TURNSTILE_TEST_BYPASS: "true" },
		);

		expect(rateLimitedEmail.status).toBe(429);
		await expect(rateLimitedEmail.json()).resolves.toMatchObject({
			error: {
				code: "RATE_LIMITED",
				scope: "email",
			},
		});
	});

	it("verifies valid sender magic links and returns stable errors for invalid or expired links", async () => {
		seedAwaitingVerificationEnvelope();

		const verified = await apiHono.request("/api/envelopes/sender-verifications/sender-token", {
			headers: { "x-now": "2026-05-21T09:05:00.000Z" },
		});

		expect(verified.status).toBe(200);
		await expect(verified.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				status: "draft",
				senderSessionToken: "sender-token",
				sender: {
					name: "Ada Lovelace",
					email: "ada@example.com",
				},
				allowedActions: ["upload_source_pdf", "add_recipients", "add_fields", "send"],
				verifiedAt: "2026-05-21T09:05:00.000Z",
			},
		});
		expect(state.envelopes[0]?.status).toBe("draft");
		expect(state.senderVerificationTokens[0]?.status).toBe("verified");
		expect(state.auditEvents).toEqual([
			expect.objectContaining({
				eventType: "sender.verified",
				message: "ada@example.com",
			}),
		]);

		const invalid = await apiHono.request("/api/envelopes/sender-verifications/not-found");
		expect(invalid.status).toBe(404);
		await expect(invalid.json()).resolves.toEqual({
			error: {
				code: "SENDER_VERIFICATION_NOT_FOUND",
				message: "Sender verification token was not found",
			},
		});

		resetState();
		seedAwaitingVerificationEnvelope();
		const expired = await apiHono.request("/api/envelopes/sender-verifications/sender-token", {
			headers: { "x-now": "2026-05-21T09:31:00.000Z" },
		});

		expect(expired.status).toBe(410);
		await expect(expired.json()).resolves.toEqual({
			error: {
				code: "EXPIRED_SENDER_VERIFICATION",
				message: "Sender verification token has expired",
			},
		});
		expect(state.envelopes[0]?.status).toBe("awaiting_verification");
	});

	it("exposes awaiting-verification and draft status with allowed next actions", async () => {
		seedAwaitingVerificationEnvelope();

		const awaiting = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/status",
		);

		expect(awaiting.status).toBe(200);
		await expect(awaiting.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				status: "awaiting_verification",
				finalPdfAvailable: false,
				allowedActions: ["verify_sender_email"],
			},
		});

		state.envelopes[0] = { ...state.envelopes[0], status: "draft" };
		const draft = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/status",
		);

		expect(draft.status).toBe(200);
		await expect(draft.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				status: "draft",
				finalPdfAvailable: false,
				allowedActions: ["upload_source_pdf", "add_recipients", "add_fields", "send"],
			},
		});
	});

	it("reuses idempotent sender starts without duplicating envelopes or verification sends", async () => {
		const request = {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"idempotency-key": "sender-start-1",
				"cf-connecting-ip": "203.0.113.10",
			},
			body: JSON.stringify({
				name: "Ada Lovelace",
				email: "ada@example.com",
				turnstileToken: "test-pass",
			}),
		};

		const first = await apiHono.request("/api/envelopes/sender-start", request, {
			TURNSTILE_TEST_BYPASS: "true",
		});
		const second = await apiHono.request("/api/envelopes/sender-start", request, {
			TURNSTILE_TEST_BYPASS: "true",
		});

		expect(first.status).toBe(201);
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(await first.json());
		expect(state.envelopes).toHaveLength(1);
		expect(state.senderVerificationEmailRecords).toHaveLength(1);
		expect(state.senderVerificationTokens).toHaveLength(1);
	});
});
