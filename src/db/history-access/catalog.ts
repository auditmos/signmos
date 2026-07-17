import { eq } from "drizzle-orm";
import { envelopeRecipients, envelopes, finalDocuments } from "@/db/envelope";
import { getDb } from "@/db/setup";
import { normalizeHistoryEmail } from "./request";

export interface MinimalHistoryDocument {
	envelopeId: string;
	status: "completed";
	role: "creator" | "signer" | "creator_and_signer";
	detailUrl: string;
	downloadUrl: string;
}

export async function listMinimalHistoryDocuments(
	email: string,
): Promise<MinimalHistoryDocument[]> {
	const db = getDb();
	const normalizedEmail = normalizeHistoryEmail(email);
	const envelopeRows = await db.select().from(envelopes).limit(100);
	const recipientRows = await db
		.select()
		.from(envelopeRecipients)
		.where(eq(envelopeRecipients.email, normalizedEmail))
		.limit(100);
	const documentRows = await db.select().from(finalDocuments).limit(100);
	const finalEnvelopeIds = new Set(documentRows.map((document) => document.envelopeId));

	return envelopeRows.flatMap((envelope) => {
		if (envelope.status !== "completed" || !finalEnvelopeIds.has(envelope.id)) return [];
		const isCreator = normalizeHistoryEmail(envelope.createdBy) === normalizedEmail;
		const isSigner = recipientRows.some(
			(recipient) =>
				recipient.envelopeId === envelope.id &&
				normalizeHistoryEmail(recipient.email) === normalizedEmail,
		);
		if (!isCreator && !isSigner) return [];
		const role = isCreator && isSigner ? "creator_and_signer" : isCreator ? "creator" : "signer";
		return [
			{
				envelopeId: envelope.id,
				status: "completed" as const,
				role,
				detailUrl: `/my-documents/${envelope.id}`,
				downloadUrl: `/api/history/documents/${envelope.id}/pdf`,
			},
		];
	});
}

export async function authorizeMinimalHistoryDocument(
	email: string,
	envelopeId: string,
): Promise<MinimalHistoryDocument | null> {
	const documents = await listMinimalHistoryDocuments(email);
	return documents.find((document) => document.envelopeId === envelopeId) ?? null;
}
