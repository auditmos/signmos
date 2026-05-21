import {
	auditEvents,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	fieldsTable: null as unknown,
	tokensTable: null as unknown,
	fieldValuesTable: null as unknown,
	auditEventsTable: null as unknown,
	sourceDocumentsTable: null as unknown,
	finalDocumentsTable: null as unknown,
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
			r2Key: "envelopes/00000000-0000-4000-8000-000000000001/source.pdf",
			sha256: "a".repeat(64),
			byteSize: 10,
			contentType: "application/pdf",
			uploadedBy: "user_123",
			uploadedAt: new Date("2026-05-20T07:01:00.000Z"),
		},
	],
	fieldValues: [] as Array<Record<string, unknown>>,
	auditEvents: [] as Array<Record<string, unknown>>,
	finalDocuments: [] as Array<Record<string, unknown>>,
	r2Objects: new Map<string, Uint8Array>(),
}));

function selectRows(table: unknown) {
	if (table === state.tokensTable) return state.tokens;
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.recipientsTable) return state.recipients;
	if (table === state.fieldsTable) return state.fields;
	if (table === state.fieldValuesTable) return state.fieldValues;
	if (table === state.auditEventsTable) return state.auditEvents;
	if (table === state.sourceDocumentsTable) return state.sourceDocuments;
	if (table === state.finalDocumentsTable) return state.finalDocuments;
	return [];
}

function insertRows(table: unknown, rows: Array<Record<string, unknown>>) {
	if (table === state.fieldValuesTable) state.fieldValues.push(...rows);
	if (table === state.auditEventsTable) state.auditEvents.push(...rows);
	if (table === state.finalDocumentsTable) state.finalDocuments.push(...rows);
	return rows;
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

describe("PDF finalization", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.recipientsTable = envelopeRecipients;
		state.fieldsTable = envelopeFields;
		state.tokensTable = signerTokens;
		state.fieldValuesTable = fieldValues;
		state.auditEventsTable = auditEvents;
		state.sourceDocumentsTable = sourceDocuments;
		state.finalDocumentsTable = finalDocuments;
		state.fieldValues.length = 0;
		state.auditEvents.length = 0;
		state.finalDocuments.length = 0;
		state.r2Objects.clear();
		state.envelopes[0] = { ...state.envelopes[0], status: "sent" };
		state.recipients[0] = { ...state.recipients[0], status: "sent" };
	});

	it("generates a final PDF with flattened values and audit summary when all recipients complete", async () => {
		const bucket = {
			put: async (key: string, value: ArrayBuffer | ArrayBufferView) => {
				const bytes =
					value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
				state.r2Objects.set(key, bytes);
				return null;
			},
		};

		const response = await apiHono.request(
			"/api/signing/valid-token/complete",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-05-20T08:00:00.000Z",
				},
				body: JSON.stringify({ signatureName: "Ada Lovelace", date: "2026-05-20" }),
			},
			{ DOCUMENTS_BUCKET: bucket },
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: expect.objectContaining({
				envelopeId: "00000000-0000-4000-8000-000000000001",
				envelopeStatus: "completed",
			}),
		});
		expect(state.finalDocuments).toHaveLength(1);
		const finalKey = state.finalDocuments[0]?.r2Key as string;
		const finalPdf = new TextDecoder().decode(state.r2Objects.get(finalKey));
		expect(finalPdf).toContain("Ada Lovelace");
		expect(finalPdf).toContain("2026-05-20");
		expect(finalPdf).toContain("signature page=1 x=72 y=144 width=180 height=48");
		expect(finalPdf).toContain("AUDIT SUMMARY");
		expect(finalPdf).toContain("recipient.completed");
	});

	it("reports final PDF availability and downloads the completed artifact", async () => {
		const finalPdf = new TextEncoder().encode("%PDF-1.4\ncompleted artifact\n%%EOF");
		const r2Key = "envelopes/00000000-0000-4000-8000-000000000001/final.pdf";
		state.finalDocuments.push({
			id: "90000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			r2Key,
			sha256: "b".repeat(64),
			byteSize: finalPdf.byteLength,
			contentType: "application/pdf",
			createdAt: new Date("2026-05-20T08:01:00.000Z"),
		});
		state.envelopes[0] = { ...state.envelopes[0], status: "completed" };
		state.r2Objects.set(r2Key, finalPdf);
		const bucket = {
			get: async (key: string) => ({
				arrayBuffer: async () => state.r2Objects.get(key)?.buffer,
			}),
		};

		const statusResponse = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/status",
		);

		expect(statusResponse.status).toBe(200);
		await expect(statusResponse.json()).resolves.toEqual({
			data: {
				envelopeId: "00000000-0000-4000-8000-000000000001",
				status: "completed",
				finalPdfAvailable: true,
				allowedActions: ["download_final_pdf"],
			},
		});

		const downloadResponse = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/final-pdf",
			undefined,
			{ DOCUMENTS_BUCKET: bucket },
		);

		expect(downloadResponse.status).toBe(200);
		expect(downloadResponse.headers.get("content-type")).toBe("application/pdf");
		expect(new TextDecoder().decode(await downloadResponse.arrayBuffer())).toContain(
			"completed artifact",
		);
	});
});
