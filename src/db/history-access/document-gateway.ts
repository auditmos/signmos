import { eq } from "drizzle-orm";
import { auditEvents, finalDocuments, getCompletedDocumentView } from "@/db/envelope";
import { getDb } from "@/db/setup";
import { authorizeMinimalHistoryDocument } from "./catalog";

export async function getHistoryCompletedDocumentView(
	email: string,
	envelopeId: string,
	now = new Date(),
) {
	const document = await getHistoryFinalDocument(email, envelopeId);
	if (!document) return null;
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
	return rows.find((document) => document.envelopeId === envelopeId) ?? null;
}

export async function recordHistoryDocumentAudit(
	envelopeId: string,
	eventType: "history.completed.opened" | "history.final_pdf.downloaded",
): Promise<void> {
	await getDb()
		.insert(auditEvents)
		.values({ envelopeId, recipientId: null, eventType, message: null })
		.returning();
}
