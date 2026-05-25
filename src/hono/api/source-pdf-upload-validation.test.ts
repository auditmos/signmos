import { auditEvents, envelopes, senderVerificationTokens, sourceDocuments } from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	senderVerificationTokensTable: null as unknown,
	sourceDocumentsTable: null as unknown,
	auditEventsTable: null as unknown,
	envelopes: [] as Array<Record<string, unknown>>,
	senderVerificationTokens: [] as Array<Record<string, unknown>>,
	sourceDocuments: [] as Array<Record<string, unknown>>,
	auditEvents: [] as Array<Record<string, unknown>>,
}));

function selectRows(table: unknown): Array<Record<string, unknown>> {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.senderVerificationTokensTable) return state.senderVerificationTokens;
	if (table === state.sourceDocumentsTable) return state.sourceDocuments;
	if (table === state.auditEventsTable) return state.auditEvents;
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
			values: (rows: Array<Record<string, unknown>> | Record<string, unknown>) => ({
				returning: async () => {
					const inserted = Array.isArray(rows) ? rows : [rows];
					if (table === state.auditEventsTable) state.auditEvents.push(...inserted);
					return inserted;
				},
			}),
		}),
	}),
}));

describe("source PDF upload validation", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.senderVerificationTokensTable = senderVerificationTokens;
		state.sourceDocumentsTable = sourceDocuments;
		state.auditEventsTable = auditEvents;
		state.envelopes = [
			{
				id: "00000000-0000-4000-8000-000000000001",
				status: "draft",
				signingMode: "only_me",
				createdBy: "ada@example.com",
				createdAt: new Date("2026-05-21T09:00:00.000Z"),
				sentBy: null,
				sentAt: null,
			},
		];
		state.senderVerificationTokens = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Ada Lovelace",
				email: "ada@example.com",
				token: "verified-sender-token",
				status: "verified",
				expiresAt: new Date("2026-05-21T09:30:00.000Z"),
				verifiedAt: new Date("2026-05-21T09:05:00.000Z"),
				createdAt: new Date("2026-05-21T09:00:00.000Z"),
			},
		];
		state.sourceDocuments.length = 0;
		state.auditEvents.length = 0;
	});

	it("rejects invalid content types with stable JSON and audit evidence", async () => {
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			{
				method: "POST",
				headers: {
					"x-sender-session-token": "verified-sender-token",
					"x-now": "2026-05-21T09:10:00.000Z",
					"content-type": "text/plain",
				},
				body: new TextEncoder().encode("not a pdf"),
			},
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "INVALID_SOURCE_PDF",
				message: "Source document must be a PDF",
				validValues: ["application/pdf"],
			},
		});
		expect(state.auditEvents).toEqual([
			expect.objectContaining({
				eventType: "source_pdf.upload_rejected",
				message: "ada@example.com",
			}),
		]);
	});
});
