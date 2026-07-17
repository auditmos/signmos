import { eq } from "drizzle-orm";
import {
	auditEvents,
	EnvelopeSchema,
	type EnvelopeStatus,
	envelopeRecipients,
	envelopes,
	RecipientSchema,
	type SignerToken,
	SignerTokenSchema,
	signerTokens,
} from "@/db/envelope";
import { getDb } from "@/db/setup";
import { normalizeHistoryEmail } from "./request";

export type HistorySignerAuthorization =
	| { state: "active"; token: SignerToken }
	| { state: "completed"; envelopeId: string; recipientId: string }
	| { state: "terminal"; status: "declined" | "expired" | "deleted" }
	| { state: "inactive"; status: EnvelopeStatus }
	| { state: "not_found" };

export async function authorizeHistorySigner(
	email: string,
	envelopeId: string,
	now = new Date(),
): Promise<HistorySignerAuthorization> {
	const db = getDb();
	const [envelopeRows, recipientRows, tokenRows] = await Promise.all([
		db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1),
		db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(10),
		db.select().from(signerTokens).where(eq(signerTokens.envelopeId, envelopeId)).limit(20),
	]);
	const envelopeRow = envelopeRows.find((candidate) => candidate.id === envelopeId);
	if (!envelopeRow) return { state: "not_found" };
	const envelope = EnvelopeSchema.parse(envelopeRow);
	const normalizedEmail = normalizeHistoryEmail(email);
	const recipients = recipientRows
		.filter((candidate) => candidate.envelopeId === envelopeId)
		.map((candidate) => RecipientSchema.parse(candidate));
	const matchingRecipients = recipients.filter(
		(recipient) => normalizeHistoryEmail(recipient.email) === normalizedEmail,
	);
	if (matchingRecipients.length === 0) return { state: "not_found" };
	if (isTerminalStatus(envelope.status)) return { state: "terminal", status: envelope.status };
	const completedRecipient = matchingRecipients.find(
		(recipient) => recipient.status === "completed",
	);
	if (envelope.status === "completed" && completedRecipient) {
		return { state: "completed", envelopeId, recipientId: completedRecipient.id };
	}
	if (envelope.status !== "sent") return { state: "inactive", status: envelope.status };
	const recipient = matchingRecipients.find(
		(candidate) => candidate.status === "pending" || candidate.status === "sent",
	);
	if (!recipient) return { state: "inactive", status: envelope.status };
	const tokenRow = tokenRows
		.filter(
			(candidate) =>
				candidate.envelopeId === envelopeId &&
				candidate.recipientId === recipient.id &&
				candidate.status === "active",
		)
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
	if (!tokenRow) return { state: "not_found" };
	let token = SignerTokenSchema.parse(tokenRow);
	if (!token.verifiedAt) {
		await db.update(signerTokens).set({ verifiedAt: now }).where(eq(signerTokens.id, token.id));
		await db
			.insert(auditEvents)
			.values({
				envelopeId,
				recipientId: recipient.id,
				eventType: "partner.verified",
				message: recipient.email,
			})
			.returning();
		token = { ...token, verifiedAt: now };
	}
	return { state: "active", token };
}

export async function recordHistorySignerAudit(input: {
	envelopeId: string;
	recipientId: string;
	eventType: string;
}): Promise<void> {
	await getDb()
		.insert(auditEvents)
		.values({ ...input, message: null })
		.returning();
}

function isTerminalStatus(status: EnvelopeStatus): status is "declined" | "expired" | "deleted" {
	return status === "declined" || status === "expired" || status === "deleted";
}
