import type { z } from "zod";
import {
	type FinalDocument,
	getEnvelopeRetentionStatus,
	getPublicEnvelopeHistory,
	listRecipients,
} from "@/db/envelope";
import {
	authorizeHistoryDocument,
	getHistoryCompletedDocumentView,
	getHistoryFinalDocument,
	type HistoryCatalogItem,
	listHistoryDocuments,
} from "@/db/history-access";
import type { AgenticPrincipal } from "./bearer-principal";
import type {
	AgentDocumentCatalogQuerySchema,
	AgentDocumentCatalogResponseSchema,
	AgentDocumentDetailResponseSchema,
} from "./schema";
import { appendAgenticSecurityEvent } from "./security-audit";

export type AgentDocumentCatalogQuery = z.infer<typeof AgentDocumentCatalogQuerySchema>;
export type AgentDocumentCatalog = z.infer<typeof AgentDocumentCatalogResponseSchema>["data"];
export type AgentDocumentDetail = z.infer<typeof AgentDocumentDetailResponseSchema>["data"];

export async function listAgentDocuments(
	principal: AgenticPrincipal,
	query: AgentDocumentCatalogQuery,
): Promise<AgentDocumentCatalog> {
	const result = await listHistoryDocuments({ email: principal.email, ...query });
	return {
		identity: { email: result.identity.email },
		documents: result.items.map(projectAgentDocument),
		pagination: result.pagination,
	};
}

export async function getAgentDocumentDetail(
	principal: AgenticPrincipal,
	documentId: string,
	now = new Date(),
): Promise<AgentDocumentDetail | null> {
	const item = await authorizeHistoryDocument(principal.email, documentId);
	if (!item) return null;
	const retention = await getEnvelopeRetentionStatus(documentId, now);
	const completedView =
		item.status === "completed"
			? await getHistoryCompletedDocumentView(principal.email, documentId, now)
			: null;
	const history = completedView?.history ?? (await getPublicEnvelopeHistory(documentId));
	if (!(await authorizeHistoryDocument(principal.email, documentId))) return null;
	return {
		document: projectAgentDocument(item),
		retention: {
			status: retention.status,
			eligibleAt: retention.retentionEligibleAt,
			eligible: retention.retentionEligible,
		},
		history,
		finalPdf: completedView
			? {
					contentType: completedView.finalPdf.contentType,
					byteSize: completedView.finalPdf.byteSize,
					sha256: completedView.finalPdf.sha256,
					createdAt: completedView.finalPdf.createdAt,
				}
			: null,
	};
}

export async function getAgentDocumentParticipantProgress(
	principal: AgenticPrincipal,
	documentId: string,
) {
	const item = await authorizeHistoryDocument(principal.email, documentId);
	if (!item) return null;
	const recipients = await listRecipients(documentId);
	return recipients.map((recipient) => ({
		name: recipient.name,
		email: recipient.email,
		role:
			item.participants.find(
				(participant) =>
					participant.email.trim().toLowerCase() === recipient.email.trim().toLowerCase(),
			)?.role ?? "signer",
		status: recipient.status,
	}));
}

export type AgentFinalDocumentAccess =
	| { state: "not_found" }
	| { state: "not_ready"; item: ReturnType<typeof projectAgentDocument> }
	| {
			state: "ready";
			item: ReturnType<typeof projectAgentDocument>;
			document: FinalDocument;
	  }
	| { state: "unavailable"; item: ReturnType<typeof projectAgentDocument> };

export async function getAgentFinalDocumentAccess(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<AgentFinalDocumentAccess> {
	const item = await authorizeHistoryDocument(principal.email, documentId);
	if (!item) return { state: "not_found" };
	const projected = projectAgentDocument(item);
	if (item.status !== "completed" || !item.allowedActions.includes("download_final_pdf")) {
		return { state: "not_ready", item: projected };
	}
	const document = await getHistoryFinalDocument(principal.email, documentId);
	return document
		? { state: "ready", item: projected, document }
		: { state: "unavailable", item: projected };
}

export async function recordAgentDocumentRead(input: {
	principal: AgenticPrincipal;
	documentId: string;
	eventType:
		| "agentic.document.listed"
		| "agentic.document.opened"
		| "agentic.document.status_read"
		| "agentic.document.history_read"
		| "agentic.source_pdf.uploaded"
		| "agentic.source_pdf.metadata_read"
		| "agentic.source_pdf.downloaded"
		| "agentic.recipients.read"
		| "agentic.recipients.added"
		| "agentic.recipient.updated"
		| "agentic.recipient.deleted"
		| "agentic.fields.read"
		| "agentic.signature_profile.created"
		| "agentic.fields.prepared"
		| "agentic.signing_task.read"
		| "agentic.field.repositioned"
		| "agentic.creator_signing.completed"
		| "agentic.document.sent"
		| "agentic.invitation.resent"
		| "agentic.self_sign.completed"
		| "agentic.partner.completed"
		| "agentic.partner.change_requested"
		| "agentic.partner.declined"
		| "agentic.final_pdf.downloaded";
	requestIp?: string;
}): Promise<void> {
	await appendAgenticSecurityEvent({
		tokenId: input.principal.token.id,
		tokenName: input.principal.token.name,
		documentId: input.documentId,
		email: input.principal.email,
		eventType: input.eventType,
		actorType: "agent",
		requestIp: input.requestIp,
	});
}

function projectAgentDocument(item: HistoryCatalogItem) {
	const root = `/api/v1/documents/${item.envelopeId}`;
	return {
		documentId: item.envelopeId,
		title: item.title,
		shortReference: item.shortReference,
		status: item.status,
		group: item.group,
		role: item.role,
		participants: item.participants,
		allowedActions: item.allowedActions,
		createdAt: item.createdAt,
		activityAt: item.activityAt,
		urls: {
			detail: root,
			status: `${root}/status`,
			history: `${root}/history`,
			finalPdf: item.status === "completed" ? `${root}/pdf` : null,
		},
	};
}
