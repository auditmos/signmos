import { getDb } from "@/db/setup";
import { agenticSecurityEvents } from "./table";

export async function appendAgenticSecurityEvent(input: {
	linkId?: string | null;
	sessionId?: string | null;
	tokenId?: string | null;
	tokenName?: string | null;
	documentId?: string | null;
	email: string;
	eventType:
		| "agentic.link.issued"
		| "agentic.link.expired"
		| "agentic.link.redeemed"
		| "agentic.session.expired"
		| "agentic.token.created"
		| "agentic.token.revoked"
		| "agentic.identity.read"
		| "agentic.document.created"
		| "agentic.source_pdf.uploaded"
		| "agentic.source_pdf.metadata_read"
		| "agentic.source_pdf.downloaded"
		| "agentic.signature_profile.created"
		| "agentic.fields.prepared"
		| "agentic.signing_task.read"
		| "agentic.field.repositioned"
		| "agentic.self_sign.completed"
		| "agentic.document.listed"
		| "agentic.document.opened"
		| "agentic.document.status_read"
		| "agentic.document.history_read"
		| "agentic.final_pdf.downloaded";
	actorType?: "browser" | "agent";
	requestIp?: string | null;
}) {
	await getDb()
		.insert(agenticSecurityEvents)
		.values({
			linkId: input.linkId ?? null,
			sessionId: input.sessionId ?? null,
			tokenId: input.tokenId ?? null,
			tokenName: input.tokenName ?? null,
			documentId: input.documentId ?? null,
			email: input.email,
			eventType: input.eventType,
			actorType: input.actorType ?? "browser",
			requestIp: input.requestIp ?? null,
		})
		.returning();
}
