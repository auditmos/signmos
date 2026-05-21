import {
	emailSendRecords,
	envelopeRecipients,
	envelopes,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	sourceDocumentsTable: null as unknown,
	signerTokensTable: null as unknown,
	emailSendRecordsTable: null as unknown,
	envelopes: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			status: "draft",
			createdBy: "user_123",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: null as string | null,
			sentAt: null as Date | null,
		},
	],
	sourceDocuments: [
		{
			id: "10000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			r2Key: "envelopes/00000000-0000-4000-8000-000000000001/source.pdf",
			sha256: "a".repeat(64),
			byteSize: 10,
			contentType: "application/pdf",
			uploadedBy: "user_123",
			uploadedAt: new Date("2026-05-20T07:01:00.000Z"),
		},
	],
	recipients: [] as Array<{
		id: string;
		envelopeId: string;
		name: string;
		email: string;
		status: "pending" | "sent";
		createdAt: Date;
	}>,
	tokens: [] as Array<{
		id: string;
		envelopeId: string;
		recipientId: string;
		token: string;
		status: "active";
		expiresAt: Date;
		createdAt: Date;
	}>,
	emailSends: [] as Array<{
		id: string;
		envelopeId: string;
		recipientId: string;
		tokenId: string;
		email: string;
		kind: "invitation" | "resend";
		sentAt: Date;
	}>,
}));

function selectRows(table: unknown) {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.sourceDocumentsTable) return state.sourceDocuments;
	if (table === state.recipientsTable) return state.recipients;
	if (table === state.signerTokensTable) return state.tokens;
	if (table === state.emailSendRecordsTable) return state.emailSends;
	return [];
}

function insertRows(table: unknown, rows: unknown[]) {
	if (table === state.recipientsTable) return insertRecipients(rows);
	if (table === state.signerTokensTable) return insertTokens(rows);
	if (table === state.emailSendRecordsTable) return insertEmailSends(rows);
	return [];
}

function insertRecipients(rows: unknown[]) {
	const inserted = rows.map((row, index) => {
		const recipient = row as { envelopeId: string; name: string; email: string; status: "pending" };
		return {
			id: `20000000-0000-4000-8000-${String(state.recipients.length + index + 1).padStart(12, "0")}`,
			envelopeId: recipient.envelopeId,
			name: recipient.name,
			email: recipient.email,
			status: recipient.status,
			createdAt: new Date("2026-05-20T07:02:00.000Z"),
		};
	});
	state.recipients.push(...inserted);
	return inserted;
}

function insertTokens(rows: unknown[]) {
	const inserted = rows.map((row, index) => {
		const token = row as {
			envelopeId: string;
			recipientId: string;
			token: string;
			status: "active";
			expiresAt: Date;
		};
		return {
			id: `30000000-0000-4000-8000-${String(state.tokens.length + index + 1).padStart(12, "0")}`,
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			token: token.token,
			status: token.status,
			expiresAt: token.expiresAt,
			createdAt: new Date("2026-05-20T07:03:00.000Z"),
		};
	});
	state.tokens.push(...inserted);
	return inserted;
}

function insertEmailSends(rows: unknown[]) {
	const inserted = rows.map((row, index) => {
		const send = row as {
			envelopeId: string;
			recipientId: string;
			tokenId: string;
			email: string;
			kind: "invitation" | "resend";
			fallbackUrl?: string;
		};
		return {
			id: `40000000-0000-4000-8000-${String(state.emailSends.length + index + 1).padStart(12, "0")}`,
			envelopeId: send.envelopeId,
			recipientId: send.recipientId,
			tokenId: send.tokenId,
			email: send.email,
			kind: send.kind,
			fallbackUrl: send.fallbackUrl,
			sentAt: new Date("2026-05-20T07:04:00.000Z"),
		};
	});
	state.emailSends.push(...inserted);
	return inserted;
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
			values: (rows: unknown[] | unknown) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (value: { status?: "sent"; sentBy?: string; sentAt?: Date }) => ({
				where: async () => {
					if (table === state.envelopesTable) {
						state.envelopes[0] = { ...state.envelopes[0], ...value };
					}
					if (table === state.recipientsTable) {
						state.recipients = state.recipients.map((recipient) => ({
							...recipient,
							status: value.status ?? recipient.status,
						}));
					}
					return [];
				},
			}),
		}),
	}),
}));

describe("envelope recipient API", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.recipientsTable = envelopeRecipients;
		state.sourceDocumentsTable = sourceDocuments;
		state.signerTokensTable = signerTokens;
		state.emailSendRecordsTable = emailSendRecords;
		state.recipients.length = 0;
		state.tokens.length = 0;
		state.emailSends.length = 0;
		state.envelopes[0] = {
			id: "00000000-0000-4000-8000-000000000001",
			status: "draft",
			createdBy: "user_123",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: null,
			sentAt: null,
		};
	});

	it("adds up to 10 recipients with valid names and emails", async () => {
		// Assumptions for issue #8 RED:
		// - Recipients are added in a batch through POST /api/envelopes/:id/recipients.
		// - The batch limit is 10 recipients per envelope.
		// - Send readiness is draft envelope + source PDF + at least one recipient.
		// - Signer tokens expire after 7 days; Resend is mocked at the external boundary.
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					recipients: [
						{ name: "Ada Lovelace", email: "ada@example.com" },
						{ name: "Grace Hopper", email: "grace@example.com" },
					],
				}),
			},
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: [
				{
					id: expect.any(String),
					envelopeId: "00000000-0000-4000-8000-000000000001",
					name: "Ada Lovelace",
					email: "ada@example.com",
					status: "pending",
					createdAt: expect.any(String),
				},
				{
					id: expect.any(String),
					envelopeId: "00000000-0000-4000-8000-000000000001",
					name: "Grace Hopper",
					email: "grace@example.com",
					status: "pending",
					createdAt: expect.any(String),
				},
			],
		});
	});

	it("rejects invalid emails and recipient batches above 10 with stable errors", async () => {
		const invalidEmail = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					recipients: [{ name: "Ada Lovelace", email: "not-an-email" }],
				}),
			},
		);

		expect(invalidEmail.status).toBe(400);
		await expect(invalidEmail.json()).resolves.toEqual({
			error: {
				code: "INVALID_RECIPIENTS",
				message: "Recipients must include 1 to 10 valid name and email entries",
				limit: 10,
			},
		});

		const tooMany = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					recipients: Array.from({ length: 11 }, (_, index) => ({
						name: `Signer ${index}`,
						email: `signer-${index}@example.com`,
					})),
				}),
			},
		);

		expect(tooMany.status).toBe(400);
		await expect(tooMany.json()).resolves.toEqual({
			error: {
				code: "INVALID_RECIPIENTS",
				message: "Recipients must include 1 to 10 valid name and email entries",
				limit: 10,
			},
		});
		expect(state.recipients).toHaveLength(0);
	});

	it("sends a ready envelope to all recipients in parallel", async () => {
		state.recipients.push(
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Ada Lovelace",
				email: "ada@example.com",
				status: "pending",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Grace Hopper",
				email: "grace@example.com",
				status: "pending",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
		);

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/actions",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "sender_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({ action: "send" }),
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				status: "sent",
				sentBy: "sender_123",
				tokenCount: 2,
				emailSendCount: 2,
				verificationLinks: [
					{
						recipientId: "20000000-0000-4000-8000-000000000001",
						email: "ada@example.com",
						token: expect.any(String),
						url: expect.stringMatching(/^\/api\/signing\/verifications\//),
						expiresAt: expect.any(String),
					},
					{
						recipientId: "20000000-0000-4000-8000-000000000002",
						email: "grace@example.com",
						token: expect.any(String),
						url: expect.stringMatching(/^\/api\/signing\/verifications\//),
						expiresAt: expect.any(String),
					},
				],
			},
		});
		expect(state.envelopes[0]?.status).toBe("sent");
		expect(state.envelopes[0]?.sentBy).toBe("sender_123");
		expect(state.tokens).toHaveLength(2);
		expect(state.emailSends).toHaveLength(2);
	});

	it("manually resends an invitation without duplicating recipients", async () => {
		state.recipients.push({
			id: "20000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Ada Lovelace",
			email: "ada@example.com",
			status: "sent",
			createdAt: new Date("2026-05-20T07:02:00.000Z"),
		});
		state.tokens.push({
			id: "30000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			token: "token-1",
			status: "active",
			expiresAt: new Date("2026-05-27T07:03:00.000Z"),
			createdAt: new Date("2026-05-20T07:03:00.000Z"),
		});
		state.emailSends.push({
			id: "40000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			tokenId: "30000000-0000-4000-8000-000000000001",
			email: "ada@example.com",
			kind: "invitation",
			sentAt: new Date("2026-05-20T07:04:00.000Z"),
		});

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients/20000000-0000-4000-8000-000000000001/resend",
			{
				method: "POST",
				headers: { "x-internal-user-id": "sender_123" },
			},
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: {
				recipientId: "20000000-0000-4000-8000-000000000001",
				email: "ada@example.com",
				emailSendCount: 2,
			},
		});
		expect(state.recipients).toHaveLength(1);
		expect(state.tokens).toHaveLength(2);
		expect(state.emailSends).toHaveLength(2);
		expect(state.emailSends[1]).toEqual(
			expect.objectContaining({
				kind: "resend",
				fallbackUrl: `/api/signing/verifications/${state.tokens[1]?.token}`,
			}),
		);
	});

	it("rejects expired signer tokens with a stable error", async () => {
		state.tokens.push({
			id: "30000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			token: "expired-token",
			status: "active",
			expiresAt: new Date("2026-05-19T07:03:00.000Z"),
			createdAt: new Date("2026-05-12T07:03:00.000Z"),
		});

		const response = await apiHono.request("/api/signing/expired-token", {
			headers: { "x-now": "2026-05-20T07:03:00.000Z" },
		});

		expect(response.status).toBe(410);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "EXPIRED_TOKEN",
				message: "Signing token has expired",
			},
		});
	});
});
