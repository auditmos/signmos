import {
	auditEvents,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	signerTokens,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	fieldsTable: null as unknown,
	tokensTable: null as unknown,
	fieldValuesTable: null as unknown,
	auditEventsTable: null as unknown,
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
			createdAt: new Date("2026-05-20T07:03:00.000Z"),
		},
	],
	fieldValues: [] as unknown[],
	auditEvents: [] as unknown[],
}));

function selectRows(table: unknown) {
	if (table === state.tokensTable) return state.tokens;
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.recipientsTable) return state.recipients;
	if (table === state.fieldsTable) return state.fields;
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
		state.fieldValuesTable = fieldValues;
		state.auditEventsTable = auditEvents;
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
