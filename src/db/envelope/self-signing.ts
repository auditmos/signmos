import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { createDefaultFieldPlacements } from "./preparation";
import { listEnvelopeFields, listRecipients } from "./queries";
import {
	type EnvelopeField,
	EnvelopeSchema,
	type Recipient,
	RecipientSchema,
	SignerTokenSchema,
} from "./schema";
import type { VerifiedSenderSession } from "./sender-start";
import {
	auditEvents,
	emailSendRecords,
	envelopeRecipients,
	envelopes,
	signerTokens,
} from "./table";

const selfSignTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

export interface SelfSignPreparation {
	recipientId: string;
	signingUrl: string;
	fieldCount: number;
	fieldPage: number;
}

export async function prepareSelfSignAfterSourceUpload(input: {
	envelopeId: string;
	sender: Pick<VerifiedSenderSession, "name" | "email">;
	fieldPage: number;
	now: Date;
}): Promise<SelfSignPreparation | null> {
	const db = getDb();
	const envelope = await getEnvelope(input.envelopeId);
	if (!envelope || envelope.signingMode !== "only_me") return null;

	const recipient = await findOrCreateSelfRecipient({
		envelopeId: input.envelopeId,
		sender: input.sender,
	});
	const fields = await findOrCreateSelfFields({
		envelopeId: input.envelopeId,
		recipientId: recipient.id,
		fieldPage: input.fieldPage,
	});
	const token = await findOrCreateSelfSignerToken({
		envelopeId: input.envelopeId,
		recipientId: recipient.id,
		now: input.now,
	});
	const signingUrl = buildSigningUrl(token.token);

	await db
		.update(envelopeRecipients)
		.set({ status: "sent" })
		.where(eq(envelopeRecipients.id, recipient.id));
	await db
		.update(envelopes)
		.set({ status: "sent", sentBy: input.sender.email, sentAt: input.now })
		.where(eq(envelopes.id, input.envelopeId));
	await ensureSelfSignSendRecord({
		envelopeId: input.envelopeId,
		recipientId: recipient.id,
		tokenId: token.id,
		email: input.sender.email,
		signingUrl,
	});
	await db
		.insert(auditEvents)
		.values([
			{
				envelopeId: input.envelopeId,
				recipientId: recipient.id,
				eventType: "self_sign.default_fields_created",
				message: `page:${input.fieldPage}`,
			},
			{
				envelopeId: input.envelopeId,
				recipientId: recipient.id,
				eventType: "self_sign.prepared",
				message: input.sender.email,
			},
		])
		.returning();

	return {
		recipientId: recipient.id,
		signingUrl,
		fieldCount: fields.length,
		fieldPage: input.fieldPage,
	};
}

export async function getSelfSignPreparation(
	envelopeId: string,
): Promise<SelfSignPreparation | null> {
	const envelope = await getEnvelope(envelopeId);
	if (!envelope || envelope.signingMode !== "only_me") return null;
	const recipients = await listRecipients(envelopeId);
	const recipient = recipients.find((candidate) => candidate.status !== "declined") ?? null;
	if (!recipient) return null;
	const fields = (await listEnvelopeFields(envelopeId)).filter(
		(field) => field.recipientId === recipient.id,
	);
	const token = await findExistingSelfSignerToken(envelopeId, recipient.id);
	if (!token) return null;
	return {
		recipientId: recipient.id,
		signingUrl: buildSigningUrl(token.token),
		fieldCount: fields.length,
		fieldPage: fields[0]?.page ?? 1,
	};
}

async function getEnvelope(envelopeId: string) {
	const db = getDb();
	const [row] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	return row ? EnvelopeSchema.parse(row) : null;
}

async function findOrCreateSelfRecipient(input: {
	envelopeId: string;
	sender: Pick<VerifiedSenderSession, "name" | "email">;
}): Promise<Recipient> {
	const recipients = await listRecipients(input.envelopeId);
	const existing =
		recipients.find((recipient) => sameEmail(recipient.email, input.sender.email)) ?? null;
	if (existing) return existing;
	const db = getDb();
	const [recipient] = await db
		.insert(envelopeRecipients)
		.values({
			envelopeId: input.envelopeId,
			name: input.sender.name,
			email: input.sender.email,
			status: "sent",
		})
		.returning();
	if (!recipient) throw new Error("Failed to create self-sign recipient");
	return RecipientSchema.parse(recipient);
}

async function findOrCreateSelfFields(input: {
	envelopeId: string;
	recipientId: string;
	fieldPage: number;
}): Promise<EnvelopeField[]> {
	const existing = (await listEnvelopeFields(input.envelopeId)).filter(
		(field) => field.recipientId === input.recipientId,
	);
	if (existing.length > 0) return existing;
	return createDefaultFieldPlacements({
		envelopeId: input.envelopeId,
		request: { recipientIds: [input.recipientId], page: input.fieldPage },
	});
}

async function findOrCreateSelfSignerToken(input: {
	envelopeId: string;
	recipientId: string;
	now: Date;
}) {
	const existing = await findExistingSelfSignerToken(input.envelopeId, input.recipientId);
	if (existing) return existing;
	const db = getDb();
	const [token] = await db
		.insert(signerTokens)
		.values({
			envelopeId: input.envelopeId,
			recipientId: input.recipientId,
			token: crypto.randomUUID(),
			status: "active",
			expiresAt: new Date(input.now.getTime() + selfSignTokenTtlMs),
			verifiedAt: input.now,
		})
		.returning();
	if (!token) throw new Error("Failed to create self-sign token");
	return SignerTokenSchema.parse(token);
}

async function findExistingSelfSignerToken(envelopeId: string, recipientId: string) {
	const db = getDb();
	const tokens = (
		await db.select().from(signerTokens).where(eq(signerTokens.envelopeId, envelopeId)).limit(100)
	)
		.map((token) => SignerTokenSchema.parse(token))
		.filter((token) => token.recipientId === recipientId);
	return (
		tokens.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
	);
}

async function ensureSelfSignSendRecord(input: {
	envelopeId: string;
	recipientId: string;
	tokenId: string;
	email: string;
	signingUrl: string;
}): Promise<void> {
	const db = getDb();
	const records = await db
		.select()
		.from(emailSendRecords)
		.where(eq(emailSendRecords.envelopeId, input.envelopeId))
		.limit(100);
	if (records.some((record) => record.tokenId === input.tokenId)) return;
	await db
		.insert(emailSendRecords)
		.values({
			envelopeId: input.envelopeId,
			recipientId: input.recipientId,
			tokenId: input.tokenId,
			email: input.email,
			kind: "sender_signing",
			fallbackUrl: input.signingUrl,
		})
		.returning();
}

function buildSigningUrl(token: string): string {
	return `/signing/${token}`;
}

function sameEmail(left: string, right: string): boolean {
	return left.trim().toLowerCase() === right.trim().toLowerCase();
}
