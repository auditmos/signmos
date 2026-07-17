import { eq } from "drizzle-orm";
import { FinalDocumentSchema, finalDocuments, getCompletedDocumentView } from "@/db/envelope";
import { getDb } from "@/db/setup";
import { authorizeMinimalHistoryDocument } from "./catalog";
import { recordHistoryEnvelopeSecurityEvent } from "./security-audit";

export async function getHistoryCompletedDocumentView(
	email: string,
	envelopeId: string,
	now = new Date(),
) {
	const document = await getHistoryFinalDocument(email, envelopeId);
	if (!document?.id) return null;
	const view = await getCompletedDocumentView(document.id, { now });
	if (!view) return null;
	const { token: _omittedBearerToken, ...tokenlessView } = view;
	return {
		...tokenlessView,
		finalPdf: {
			...tokenlessView.finalPdf,
			downloadUrl: `/api/history/documents/${envelopeId}/pdf`,
		},
	};
}

export async function getHistoryFinalDocument(email: string, envelopeId: string) {
	const authorized = await authorizeMinimalHistoryDocument(email, envelopeId);
	if (!authorized) return null;
	const rows = await getDb()
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, envelopeId))
		.limit(1);
	const document = rows.find((candidate) => candidate.envelopeId === envelopeId);
	return document ? FinalDocumentSchema.parse(document) : null;
}

export async function recordHistoryDocumentAudit(input: {
	session: { id: string; email: string };
	envelopeId: string;
	eventType: "history.completed.opened" | "history.final_pdf.downloaded";
	requestIp?: string | null;
}): Promise<void> {
	await recordHistoryEnvelopeSecurityEvent(input);
}
