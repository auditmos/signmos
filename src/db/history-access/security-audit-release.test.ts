import { historySecurityEventTypes, recordHistoryEnvelopeSecurityEvent } from "./security-audit";
import { historySecurityEvents } from "./table";

const state = vi.hoisted(() => ({
	table: null as unknown,
	rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		insert: (table: unknown) => ({
			values: (row: Record<string, unknown>) => ({
				returning: async () => {
					state.table = table;
					state.rows.push(row);
					return [row];
				},
			}),
		}),
	}),
}));

describe("My documents release security-audit contract", () => {
	beforeEach(() => {
		state.table = null;
		state.rows = [];
	});

	it("enumerates the complete credential, session, document, and action security stream", () => {
		expect(historySecurityEventTypes).toEqual([
			"history.link.issued",
			"history.link.redeemed",
			"history.link.expired",
			"history.link.revoked",
			"history.session.expired",
			"history.session.revoked",
			"history.completed.opened",
			"history.final_pdf.downloaded",
			"history.creator.opened",
			"history.creator.started",
			"history.creator.canceled",
			"history.creator.deleted",
			"history.signer.source_pdf.opened",
			"history.signer.completed",
			"history.signer.change_requested",
			"history.signer.declined",
		]);
	});

	it("records envelope access with safe session, identity, envelope, and request references", async () => {
		const rawCredential = "raw-history-session-must-not-be-recorded";
		await recordHistoryEnvelopeSecurityEvent({
			session: {
				id: "40000000-0000-4000-8000-000000000042",
				email: "owner@example.com",
			},
			envelopeId: "00000000-0000-4000-8000-000000000042",
			eventType: "history.final_pdf.downloaded",
			requestIp: "203.0.113.42",
		});

		expect(state.table).toBe(historySecurityEvents);
		expect(state.rows).toEqual([
			{
				linkId: null,
				sessionId: "40000000-0000-4000-8000-000000000042",
				envelopeId: "00000000-0000-4000-8000-000000000042",
				email: "owner@example.com",
				eventType: "history.final_pdf.downloaded",
				requestIp: "203.0.113.42",
			},
		]);
		expect(JSON.stringify(state.rows)).not.toContain(rawCredential);
	});
});
