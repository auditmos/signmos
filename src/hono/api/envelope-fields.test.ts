import { envelopeFields, envelopeRecipients, envelopes } from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	fieldsTable: null as unknown,
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
	recipients: [
		{
			id: "20000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Ada Lovelace",
			email: "ada@example.com",
			status: "pending",
			createdAt: new Date("2026-05-20T07:02:00.000Z"),
		},
	],
	fields: [] as Array<{
		id: string;
		envelopeId: string;
		recipientId: string;
		type: "signature" | "date";
		page: number;
		x: number;
		y: number;
		width: number;
		height: number;
		createdAt: Date;
	}>,
}));

function selectRows(table: unknown) {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.recipientsTable) return state.recipients;
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
			values: (
				rows: Array<{
					envelopeId: string;
					recipientId: string;
					type: "signature" | "date";
					page: number;
					x: number;
					y: number;
					width: number;
					height: number;
				}>,
			) => ({
				returning: async () => {
					if (table !== state.fieldsTable) return [];
					const inserted = rows.map((row, index) => ({
						id: `50000000-0000-4000-8000-${String(state.fields.length + index + 1).padStart(12, "0")}`,
						...row,
						createdAt: new Date("2026-05-20T07:05:00.000Z"),
					}));
					state.fields.push(...inserted);
					return inserted;
				},
			}),
		}),
	}),
}));

describe("envelope field API", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.recipientsTable = envelopeRecipients;
		state.fieldsTable = envelopeFields;
		state.fields.length = 0;
		state.envelopes[0] = {
			id: "00000000-0000-4000-8000-000000000001",
			status: "draft",
			createdBy: "user_123",
			createdAt: new Date("2026-05-20T07:00:00.000Z"),
			sentBy: null,
			sentAt: null,
		};
		state.recipients.splice(1);
	});

	it("creates signature and date fields with shared PDF coordinates", async () => {
		// Assumptions for issue #9 RED:
		// - API and visual editor share POST /api/envelopes/:id/fields.
		// - Valid field types are signature and date.
		// - Coordinates are page-relative numbers: page >= 1, x/y >= 0, width/height > 0.
		// - Recipients must already exist and fields are only mutable while envelope status is draft.
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/fields",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					fields: [
						{
							recipientId: "20000000-0000-4000-8000-000000000001",
							type: "signature",
							page: 1,
							x: 72,
							y: 144,
							width: 180,
							height: 48,
						},
						{
							recipientId: "20000000-0000-4000-8000-000000000001",
							type: "date",
							page: 1,
							x: 300,
							y: 144,
							width: 120,
							height: 32,
						},
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
					recipientId: "20000000-0000-4000-8000-000000000001",
					type: "signature",
					page: 1,
					x: 72,
					y: 144,
					width: 180,
					height: 48,
					createdAt: expect.any(String),
				},
				{
					id: expect.any(String),
					envelopeId: "00000000-0000-4000-8000-000000000001",
					recipientId: "20000000-0000-4000-8000-000000000001",
					type: "date",
					page: 1,
					x: 300,
					y: 144,
					width: 120,
					height: 32,
					createdAt: expect.any(String),
				},
			],
		});
	});

	it("rejects invalid field inputs with valid field types listed", async () => {
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/fields",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					fields: [
						{
							recipientId: "20000000-0000-4000-8000-000000000099",
							type: "text",
							page: 0,
							x: -1,
							y: 144,
							width: 0,
							height: 48,
						},
					],
				}),
			},
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "INVALID_FIELDS",
				message: "Fields must use valid type, page, geometry, and recipient values",
				validFieldTypes: ["signature", "date"],
				allowedActions: ["add_fields"],
			},
		});
		expect(state.fields).toHaveLength(0);
	});

	it("creates default bottom-right signature and date fields without explicit coordinates", async () => {
		state.recipients.push({
			id: "20000000-0000-4000-8000-000000000002",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Grace Hopper",
			email: "grace@example.com",
			status: "pending",
			createdAt: new Date("2026-05-20T07:03:00.000Z"),
		});

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/fields/defaults",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					recipientIds: [
						"20000000-0000-4000-8000-000000000001",
						"20000000-0000-4000-8000-000000000002",
					],
				}),
			},
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: [
				expect.objectContaining({
					recipientId: "20000000-0000-4000-8000-000000000001",
					type: "signature",
					page: 1,
					x: 360,
					y: 628,
					width: 180,
					height: 48,
				}),
				expect.objectContaining({
					recipientId: "20000000-0000-4000-8000-000000000001",
					type: "date",
					page: 1,
					x: 420,
					y: 688,
					width: 120,
					height: 32,
				}),
				expect.objectContaining({
					recipientId: "20000000-0000-4000-8000-000000000002",
					type: "signature",
					page: 1,
					x: 360,
					y: 512,
					width: 180,
					height: 48,
				}),
				expect.objectContaining({
					recipientId: "20000000-0000-4000-8000-000000000002",
					type: "date",
					page: 1,
					x: 420,
					y: 572,
					width: 120,
					height: 32,
				}),
			],
		});
	});

	it("rejects field changes after the envelope is sent", async () => {
		state.envelopes[0] = { ...state.envelopes[0], status: "sent", sentBy: "sender_123" };

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/fields",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					fields: [
						{
							recipientId: "20000000-0000-4000-8000-000000000001",
							type: "signature",
							page: 1,
							x: 72,
							y: 144,
							width: 180,
							height: 48,
						},
					],
				}),
			},
		);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "ENVELOPE_NOT_DRAFT",
				message: "Fields can only be changed while the envelope is draft",
				allowedActions: ["upload_source_pdf", "add_recipients", "add_fields", "send"],
			},
		});
		expect(state.fields).toHaveLength(0);
	});
});
