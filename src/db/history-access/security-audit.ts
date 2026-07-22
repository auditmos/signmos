import { getDb } from "@/db/setup";
import { historySecurityEvents } from "./table";

export const historySecurityEventTypes = [
	"history.link.issued",
	"history.link.redeemed",
	"history.link.expired",
	"history.link.revoked",
	"history.session.bridged",
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
	"human_review.opened",
	"human_review.source_pdf_opened",
	"human_review.approved",
	"human_review.rejected",
	"human_review.executed",
	"human_review.execution_failed",
] as const;

export type HistorySecurityEventType = (typeof historySecurityEventTypes)[number];

export async function appendHistorySecurityEvent(input: {
	linkId?: string | null;
	sessionId?: string | null;
	envelopeId?: string | null;
	email: string;
	eventType: HistorySecurityEventType;
	requestIp?: string | null;
}) {
	await getDb()
		.insert(historySecurityEvents)
		.values({
			linkId: input.linkId ?? null,
			sessionId: input.sessionId ?? null,
			envelopeId: input.envelopeId ?? null,
			email: input.email,
			eventType: input.eventType,
			requestIp: input.requestIp ?? null,
		})
		.returning();
}

export async function recordHistoryEnvelopeSecurityEvent(input: {
	session: { id: string; email: string };
	envelopeId: string;
	eventType: Exclude<
		HistorySecurityEventType,
		| "history.link.issued"
		| "history.link.redeemed"
		| "history.link.expired"
		| "history.link.revoked"
		| "history.session.bridged"
		| "history.session.expired"
		| "history.session.revoked"
	>;
	requestIp?: string | null;
}) {
	await appendHistorySecurityEvent({
		sessionId: input.session.id,
		envelopeId: input.envelopeId,
		email: input.session.email,
		eventType: input.eventType,
		requestIp: input.requestIp,
	});
}
