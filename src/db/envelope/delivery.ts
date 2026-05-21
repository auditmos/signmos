import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	EnvelopeSchema,
	type Recipient,
	RecipientSchema,
	type ResendInvitationResult,
	type SendEnvelopeResult,
	type SignerToken,
	SignerTokenSchema,
} from "./schema";
import {
	auditEvents,
	emailSendRecords,
	envelopeRecipients,
	envelopes,
	signerTokens,
	sourceDocuments,
} from "./table";

const partnerVerificationTtlMs = 7 * 24 * 60 * 60 * 1000;

export async function sendEnvelope(
	envelopeId: string,
	sentBy: string,
): Promise<SendEnvelopeResult> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	if (parsedEnvelope.status === "sent") {
		return getExistingSendResult(envelopeId, parsedEnvelope.sentBy ?? sentBy);
	}
	if (parsedEnvelope.status !== "draft") throw new Error("Envelope must be draft");

	const documents = await db
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.envelopeId, envelopeId))
		.limit(1);
	if (documents.length === 0) throw new Error("Envelope source PDF required");

	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(10)
	).map((recipient) => RecipientSchema.parse(recipient));
	if (recipients.length === 0) throw new Error("Envelope recipients required");

	const expiresAt = new Date(Date.now() + partnerVerificationTtlMs);
	const tokens = await db
		.insert(signerTokens)
		.values(
			recipients.map((recipient) => ({
				envelopeId,
				recipientId: recipient.id,
				token: crypto.randomUUID(),
				status: "active",
				expiresAt,
			})),
		)
		.returning();
	const verificationLinks = toVerificationLinks(
		recipients,
		tokens.map((token) => SignerTokenSchema.parse(token)),
	);

	await db
		.insert(emailSendRecords)
		.values(
			recipients.map((recipient, index) => ({
				envelopeId,
				recipientId: recipient.id,
				tokenId: tokens[index]?.id ?? "",
				email: recipient.email,
				kind: "partner_verification",
				fallbackUrl: verificationLinks[index]?.url ?? "",
			})),
		)
		.returning();
	await db
		.insert(auditEvents)
		.values([
			{ envelopeId, recipientId: null, eventType: "envelope.sent", message: sentBy },
			...recipients.map((recipient) => ({
				envelopeId,
				recipientId: recipient.id,
				eventType: "partner.verification.sent",
				message: recipient.email,
			})),
		])
		.returning();

	await db
		.update(envelopes)
		.set({ status: "sent", sentBy, sentAt: new Date() })
		.where(eq(envelopes.id, envelopeId));
	await db
		.update(envelopeRecipients)
		.set({ status: "sent" })
		.where(eq(envelopeRecipients.envelopeId, envelopeId));

	return {
		envelopeId,
		status: "sent",
		sentBy,
		tokenCount: tokens.length,
		emailSendCount: recipients.length,
		verificationLinks,
	};
}

async function getExistingSendResult(
	envelopeId: string,
	sentBy: string,
): Promise<SendEnvelopeResult> {
	const db = getDb();
	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(10)
	).map((recipient) => RecipientSchema.parse(recipient));
	const tokens = (
		await db.select().from(signerTokens).where(eq(signerTokens.envelopeId, envelopeId)).limit(100)
	).map((token) => SignerTokenSchema.parse(token));
	const sends = await db
		.select()
		.from(emailSendRecords)
		.where(eq(emailSendRecords.envelopeId, envelopeId))
		.limit(100);

	return {
		envelopeId,
		status: "sent",
		sentBy,
		tokenCount: tokens.length,
		emailSendCount: sends.length,
		verificationLinks: toVerificationLinks(recipients, tokens),
	};
}

export async function resendInvitation(
	envelopeId: string,
	recipientId: string,
): Promise<ResendInvitationResult> {
	const db = getDb();
	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(10)
	).map((recipient) => RecipientSchema.parse(recipient));
	const recipient = recipients.find((candidate) => candidate.id === recipientId);
	if (!recipient) throw new Error("Recipient not found");

	const [token] = await db
		.insert(signerTokens)
		.values([
			{
				envelopeId,
				recipientId,
				token: crypto.randomUUID(),
				status: "active",
				expiresAt: new Date(Date.now() + partnerVerificationTtlMs),
			},
		])
		.returning();
	if (!token) throw new Error("Failed to create signer token");

	await db
		.insert(emailSendRecords)
		.values([
			{
				envelopeId,
				recipientId,
				tokenId: token.id,
				email: recipient.email,
				kind: "resend",
				fallbackUrl: buildPartnerVerificationUrl(token.token),
			},
		])
		.returning();

	const sends = await db
		.select()
		.from(emailSendRecords)
		.where(eq(emailSendRecords.recipientId, recipientId))
		.limit(100);
	return {
		recipientId,
		email: recipient.email,
		emailSendCount: sends.length,
	};
}

function buildPartnerVerificationUrl(token: string): string {
	return `/api/signing/verifications/${token}`;
}

function toVerificationLinks(recipients: Recipient[], tokens: SignerToken[]) {
	return recipients.map((recipient) => {
		const token = tokens.find((candidate) => candidate.recipientId === recipient.id);
		if (!token) throw new Error("Sent envelope missing partner token");
		return {
			recipientId: recipient.id,
			email: recipient.email,
			token: token.token,
			url: buildPartnerVerificationUrl(token.token),
			expiresAt: token.expiresAt.toISOString(),
		};
	});
}
