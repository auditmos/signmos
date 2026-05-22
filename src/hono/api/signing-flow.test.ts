import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	fieldsTable: null as unknown,
	tokensTable: null as unknown,
	sourceDocumentsTable: null as unknown,
	fieldValuesTable: null as unknown,
	auditEventsTable: null as unknown,
	emailSendRecordsTable: null as unknown,
	envelopes: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			status: "sent",
			createdBy: "user_123",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: "sender_123",
			sentAt: new Date("2026-05-20T07:04:00.000Z"),
		},
	],
	recipients: [
		{
			id: "20000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Ada Lovelace",
			email: "ada@example.com",
			status: "sent",
			createdAt: new Date("2026-05-20T07:02:00.000Z"),
		},
		{
			id: "20000000-0000-4000-8000-000000000002",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Grace Hopper",
			email: "grace@example.com",
			status: "sent",
			createdAt: new Date("2026-05-20T07:02:00.000Z"),
		},
	],
	fields: [
		{
			id: "50000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			type: "signature",
			page: 1,
			x: 72,
			y: 144,
			width: 180,
			height: 48,
			createdAt: new Date("2026-05-20T07:05:00.000Z"),
		},
		{
			id: "50000000-0000-4000-8000-000000000002",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			type: "date",
			page: 1,
			x: 300,
			y: 144,
			width: 120,
			height: 32,
			createdAt: new Date("2026-05-20T07:05:00.000Z"),
		},
	],
	tokens: [
		{
			id: "30000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			recipientId: "20000000-0000-4000-8000-000000000001",
			token: "valid-token",
			status: "active",
			expiresAt: new Date("2026-05-27T07:03:00.000Z"),
			verifiedAt: new Date("2026-05-20T07:04:00.000Z"),
			createdAt: new Date("2026-05-20T07:03:00.000Z"),
		},
	],
	sourceDocuments: [
		{
			id: "10000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			r2Key: "envelopes/00000000-0000-4000-8000-000000000001/source-v1.pdf",
			version: 1,
			sha256: "a".repeat(64),
			byteSize: 10,
			contentType: "application/pdf",
			uploadedBy: "sender_123",
			uploadedAt: new Date("2026-05-20T07:01:00.000Z"),
		},
	],
	fieldValues: [] as unknown[],
	auditEvents: [] as unknown[],
	emailSends: [] as Array<Record<string, unknown>>,
}));

function selectRows(table: unknown) {
	if (table === state.tokensTable) return state.tokens;
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.recipientsTable) return state.recipients;
	if (table === state.fieldsTable) return state.fields;
	if (table === state.sourceDocumentsTable) return state.sourceDocuments;
	if (table === state.emailSendRecordsTable) return state.emailSends;
	return [];
}

function insertRows(table: unknown, rows: unknown[]) {
	if (table === state.fieldValuesTable) {
		state.fieldValues.push(...rows);
		return rows;
	}
	if (table === state.auditEventsTable) {
		state.auditEvents.push(...rows);
		return rows;
	}
	if (table === state.emailSendRecordsTable) {
		state.emailSends.push(...(rows as Array<Record<string, unknown>>));
		return rows;
	}
	return [];
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
			set: (value: { status?: string }) => ({
				where: async () => {
					if (table === state.recipientsTable) {
						state.recipients[0] = { ...state.recipients[0], status: value.status ?? "sent" };
					}
					if (table === state.envelopesTable) {
						state.envelopes[0] = { ...state.envelopes[0], status: value.status ?? "sent" };
					}
					return [];
				},
			}),
		}),
	}),
}));

describe("signing flow API", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.recipientsTable = envelopeRecipients;
		state.fieldsTable = envelopeFields;
		state.tokensTable = signerTokens;
		state.sourceDocumentsTable = sourceDocuments;
		state.fieldValuesTable = fieldValues;
		state.auditEventsTable = auditEvents;
		state.emailSendRecordsTable = emailSendRecords;
		state.envelopes[0] = {
			id: "00000000-0000-4000-8000-000000000001",
			status: "sent",
			createdBy: "user_123",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: "sender_123",
			sentAt: new Date("2026-05-20T07:04:00.000Z"),
		};
		state.recipients = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Ada Lovelace",
				email: "ada@example.com",
				status: "sent",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Grace Hopper",
				email: "grace@example.com",
				status: "sent",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
		];
		state.fields = [
			{
				id: "50000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				type: "signature",
				page: 1,
				x: 72,
				y: 144,
				width: 180,
				height: 48,
				createdAt: new Date("2026-05-20T07:05:00.000Z"),
			},
			{
				id: "50000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				type: "date",
				page: 1,
				x: 300,
				y: 144,
				width: 120,
				height: 32,
				createdAt: new Date("2026-05-20T07:05:00.000Z"),
			},
		];
		state.tokens = [
			{
				id: "30000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				token: "valid-token",
				status: "active",
				expiresAt: new Date("2026-05-27T07:03:00.000Z"),
				verifiedAt: new Date("2026-05-20T07:04:00.000Z"),
				createdAt: new Date("2026-05-20T07:03:00.000Z"),
			},
		];
		state.fieldValues.length = 0;
		state.auditEvents.length = 0;
		state.emailSends.length = 0;
	});

	it("opens a valid magic link without internal login and returns only assigned fields", async () => {
		const response = await apiHono.request("/api/signing/valid-token", {
			headers: { "x-now": "2026-05-20T07:03:00.000Z" },
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				sourceDocument: {
					version: 1,
					contentType: "application/pdf",
					downloadUrl: "/api/signing/valid-token/source-pdf",
				},
				fields: [
					expect.objectContaining({
						id: "50000000-0000-4000-8000-000000000001",
						type: "signature",
						page: 1,
					}),
					expect.objectContaining({
						id: "50000000-0000-4000-8000-000000000002",
						type: "date",
						page: 1,
					}),
				],
			},
		});
	});

	it("downloads the current source PDF for a verified partner", async () => {
		const response = await apiHono.request(
			"/api/signing/valid-token/source-pdf",
			{
				headers: { "x-now": "2026-05-20T07:03:00.000Z" },
			},
			{
				DOCUMENTS_BUCKET: {
					get: async (key: string) => ({
						arrayBuffer: async () => new TextEncoder().encode(`%PDF-1.7 ${key}\n%%EOF`).buffer,
					}),
				},
			},
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(new TextDecoder().decode(await response.arrayBuffer())).toContain("source-v1.pdf");
	});

	it("completes typed signature and date fields while other recipients remain outstanding", async () => {
		const response = await apiHono.request("/api/signing/valid-token/complete", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-now": "2026-05-20T08:00:00.000Z",
			},
			body: JSON.stringify({
				signatureName: "Ada Lovelace",
				date: "2026-05-20",
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				recipientStatus: "completed",
				envelopeStatus: "sent",
			},
		});
		expect(state.fieldValues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fieldId: "50000000-0000-4000-8000-000000000001",
					value: "Ada Lovelace",
				}),
				expect.objectContaining({
					fieldId: "50000000-0000-4000-8000-000000000002",
					value: "2026-05-20",
				}),
			]),
		);
		expect(state.recipients[0]?.status).toBe("completed");
		expect(state.envelopes[0]?.status).toBe("sent");
		expect(state.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventType: "recipient.completed" }),
				expect.objectContaining({ eventType: "field.value.completed" }),
			]),
		);
	});

	it("notifies the sender when the partner completes after sender-first signing", async () => {
		// Assumptions for issue #24:
		// - Sender-first send has already completed the sender recipient.
		// - The active signing token belongs to the partner.
		// - The sender notification is represented by an email_send_records row.
		state.envelopes[0] = {
			id: "00000000-0000-4000-8000-000000000001",
			status: "sent",
			createdBy: "sender@example.com",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: "sender@example.com",
			sentAt: new Date("2026-05-20T07:04:00.000Z"),
		};
		state.recipients = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Sender Person",
				email: "sender@example.com",
				status: "completed",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Grace Hopper",
				email: "grace@example.com",
				status: "sent",
				createdAt: new Date("2026-05-20T07:02:00.000Z"),
			},
		];
		state.fields = [
			{
				id: "50000000-0000-4000-8000-000000000003",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000002",
				type: "signature",
				page: 1,
				x: 72,
				y: 220,
				width: 180,
				height: 48,
				createdAt: new Date("2026-05-20T07:05:00.000Z"),
			},
		];
		state.tokens = [
			{
				id: "30000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000002",
				token: "valid-token",
				status: "active",
				expiresAt: new Date("2026-05-27T07:03:00.000Z"),
				verifiedAt: new Date("2026-05-20T07:04:00.000Z"),
				createdAt: new Date("2026-05-20T07:03:00.000Z"),
			},
		];

		const response = await apiHono.request("/api/signing/valid-token/complete", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-now": "2026-05-20T08:00:00.000Z",
			},
			body: JSON.stringify({
				signatureName: "Grace Hopper",
				date: "2026-05-20",
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000002",
				recipientStatus: "completed",
				envelopeStatus: "completed",
			},
		});
		expect(state.emailSends).toEqual([
			expect.objectContaining({
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000002",
				tokenId: "30000000-0000-4000-8000-000000000002",
				email: "sender@example.com",
				kind: "partner_signed",
				fallbackUrl: "/envelope-fields?envelopeId=00000000-0000-4000-8000-000000000001",
			}),
		]);
	});

	it("rejects completion when the signer has no assigned fields", async () => {
		state.fields = [];

		const response = await apiHono.request("/api/signing/valid-token/complete", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-now": "2026-05-20T08:00:00.000Z",
			},
			body: JSON.stringify({
				signatureName: "Ada Lovelace",
				date: "2026-05-20",
			}),
		});

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "NO_ASSIGNED_FIELDS",
				message: "No signing fields are assigned to this recipient",
				allowedActions: ["request_changes"],
			},
		});
		expect(state.fieldValues).toHaveLength(0);
		expect(state.recipients[0]?.status).toBe("sent");
		expect(state.envelopes[0]?.status).toBe("sent");
	});

	it("declines with a reason and optional comment while appending audit events", async () => {
		const response = await apiHono.request("/api/signing/valid-token/decline", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-now": "2026-05-20T08:00:00.000Z",
			},
			body: JSON.stringify({
				reason: "Terms need legal review",
				comment: "Please send an updated version.",
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				recipientId: "20000000-0000-4000-8000-000000000001",
				recipientStatus: "declined",
				envelopeStatus: "declined",
			},
		});
		expect(state.recipients[0]?.status).toBe("declined");
		expect(state.envelopes[0]?.status).toBe("declined");
		expect(state.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					eventType: "recipient.declined",
					message: "Terms need legal review",
				}),
				expect.objectContaining({
					eventType: "recipient.comment",
					message: "Please send an updated version.",
				}),
			]),
		);
	});
});
