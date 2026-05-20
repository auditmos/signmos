import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { finalizeCompletedEnvelope } from "./finalization";
import {
	type AddFieldsRequest,
	type AddRecipientsRequest,
	type AttachSourceDocumentInput,
	type CompleteSigningRequest,
	type CompleteSigningResult,
	type CreateEnvelopeInput,
	type DeclineSigningRequest,
	type DeclineSigningResult,
	type Envelope,
	type EnvelopeField,
	EnvelopeFieldSchema,
	EnvelopeSchema,
	type Recipient,
	RecipientSchema,
	type ResendInvitationResult,
	type SendEnvelopeResult,
	type SignerSession,
	type SignerToken,
	SignerTokenSchema,
	type SourceDocument,
	SourceDocumentSchema,
} from "./schema";
import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	idempotencyRecords,
	signerTokens,
	sourceDocuments,
} from "./table";

const createEnvelopeOperation = "envelope.create";
const uploadSourcePdfOperation = "source-pdf.upload";

export interface CreateEnvelopeResult {
	envelope: Envelope;
	reused: boolean;
}

export interface AttachSourceDocumentResult {
	document: SourceDocument;
	reused: boolean;
}

export async function createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
	const db = getDb();
	if (input.idempotencyKey) {
		const [record] = await db
			.select()
			.from(idempotencyRecords)
			.where(
				and(
					eq(idempotencyRecords.key, input.idempotencyKey),
					eq(idempotencyRecords.operation, createEnvelopeOperation),
					eq(idempotencyRecords.createdBy, input.createdBy),
				),
			)
			.limit(1);
		if (record) {
			const [envelope] = await db
				.select()
				.from(envelopes)
				.where(eq(envelopes.id, record.envelopeId))
				.limit(1);
			if (!envelope) throw new Error("Idempotent envelope result not found");
			return { envelope: EnvelopeSchema.parse(envelope), reused: true };
		}
	}

	const [envelope] = await db
		.insert(envelopes)
		.values({ createdBy: input.createdBy, status: "draft" })
		.returning();
	if (!envelope) throw new Error("Failed to create envelope");

	if (input.idempotencyKey) {
		await db
			.insert(idempotencyRecords)
			.values({
				key: input.idempotencyKey,
				operation: createEnvelopeOperation,
				createdBy: input.createdBy,
				envelopeId: envelope.id,
			})
			.returning();
	}

	return { envelope: EnvelopeSchema.parse(envelope), reused: false };
}

export async function attachSourceDocument(
	input: AttachSourceDocumentInput,
): Promise<AttachSourceDocumentResult> {
	const db = getDb();
	const [envelope] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, input.envelopeId))
		.limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	if (parsedEnvelope.status !== "draft") throw new Error("Envelope must be draft");

	if (input.idempotencyKey) {
		const [record] = await db
			.select()
			.from(idempotencyRecords)
			.where(
				and(
					eq(idempotencyRecords.key, input.idempotencyKey),
					eq(idempotencyRecords.operation, uploadSourcePdfOperation),
					eq(idempotencyRecords.createdBy, input.uploadedBy),
				),
			)
			.limit(1);
		if (record) {
			const [document] = await db
				.select()
				.from(sourceDocuments)
				.where(eq(sourceDocuments.envelopeId, record.envelopeId))
				.limit(1);
			if (!document) throw new Error("Idempotent source document result not found");
			return { document: SourceDocumentSchema.parse(document), reused: true };
		}
	}

	const [document] = await db
		.insert(sourceDocuments)
		.values({
			envelopeId: input.envelopeId,
			r2Key: input.r2Key,
			sha256: input.sha256,
			byteSize: input.byteSize,
			contentType: input.contentType,
			uploadedBy: input.uploadedBy,
		})
		.returning();
	if (!document) throw new Error("Failed to attach source document");

	if (input.idempotencyKey) {
		await db
			.insert(idempotencyRecords)
			.values({
				key: input.idempotencyKey,
				operation: uploadSourcePdfOperation,
				createdBy: input.uploadedBy,
				envelopeId: input.envelopeId,
			})
			.returning();
	}

	return { document: SourceDocumentSchema.parse(document), reused: false };
}

export async function addRecipients(
	envelopeId: string,
	input: AddRecipientsRequest,
): Promise<Recipient[]> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	if (!envelope) throw new Error("Envelope not found");

	const rows = await db
		.insert(envelopeRecipients)
		.values(
			input.recipients.map((recipient) => ({
				envelopeId,
				name: recipient.name,
				email: recipient.email,
				status: "pending",
			})),
		)
		.returning();
	return rows.map((recipient) => RecipientSchema.parse(recipient));
}

export async function sendEnvelope(
	envelopeId: string,
	sentBy: string,
): Promise<SendEnvelopeResult> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
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

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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

	await db
		.insert(emailSendRecords)
		.values(
			recipients.map((recipient, index) => ({
				envelopeId,
				recipientId: recipient.id,
				tokenId: tokens[index]?.id ?? "",
				email: recipient.email,
				kind: "invitation",
			})),
		)
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
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

export async function resolveSignerToken(token: string): Promise<SignerToken | null> {
	const db = getDb();
	const tokens = await db.select().from(signerTokens).where(eq(signerTokens.token, token)).limit(1);
	const found = tokens[0];
	return found ? SignerTokenSchema.parse(found) : null;
}

export async function getSignerSession(token: SignerToken): Promise<SignerSession> {
	const db = getDb();
	const fields = (
		await db
			.select()
			.from(envelopeFields)
			.where(eq(envelopeFields.recipientId, token.recipientId))
			.limit(100)
	).map((field) => EnvelopeFieldSchema.parse(field));

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		fields: fields.map((field) => ({
			id: field.id,
			type: field.type,
			page: field.page,
			x: field.x,
			y: field.y,
			width: field.width,
			height: field.height,
		})),
	};
}

export async function completeSigning(
	token: SignerToken,
	input: CompleteSigningRequest,
	options: { documentsBucket?: R2Bucket } = {},
): Promise<CompleteSigningResult> {
	const db = getDb();
	const fields = (
		await db
			.select()
			.from(envelopeFields)
			.where(eq(envelopeFields.recipientId, token.recipientId))
			.limit(100)
	).map((field) => EnvelopeFieldSchema.parse(field));

	await db
		.insert(fieldValues)
		.values(
			fields.map((field) => ({
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				fieldId: field.id,
				value: field.type === "signature" ? input.signatureName : input.date,
			})),
		)
		.returning();
	await db
		.insert(auditEvents)
		.values([
			{
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				eventType: "field.value.completed",
				message: input.signatureName,
			},
			{
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				eventType: "recipient.completed",
				message: null,
			},
		])
		.returning();
	await db
		.update(envelopeRecipients)
		.set({ status: "completed" })
		.where(eq(envelopeRecipients.id, token.recipientId));

	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, token.envelopeId))
			.limit(10)
	).map((recipient) => RecipientSchema.parse(recipient));
	const envelopeStatus = recipients.every(
		(recipient) => recipient.id === token.recipientId || recipient.status === "completed",
	)
		? "completed"
		: "sent";
	if (envelopeStatus === "completed") {
		await db
			.update(envelopes)
			.set({ status: "completed" })
			.where(eq(envelopes.id, token.envelopeId));
		await finalizeCompletedEnvelope(token.envelopeId, options);
	}

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		recipientStatus: "completed",
		envelopeStatus,
	};
}

export async function declineSigning(
	token: SignerToken,
	input: DeclineSigningRequest,
): Promise<DeclineSigningResult> {
	const db = getDb();
	const events = [
		{
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			eventType: "recipient.declined",
			message: input.reason,
		},
	];
	if (input.comment) {
		events.push({
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			eventType: "recipient.comment",
			message: input.comment,
		});
	}
	await db.insert(auditEvents).values(events).returning();
	await db
		.update(envelopeRecipients)
		.set({ status: "declined" })
		.where(eq(envelopeRecipients.id, token.recipientId));
	await db.update(envelopes).set({ status: "declined" }).where(eq(envelopes.id, token.envelopeId));

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		recipientStatus: "declined",
		envelopeStatus: "declined",
	};
}

export async function addFields(
	envelopeId: string,
	input: AddFieldsRequest,
): Promise<EnvelopeField[]> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	if (parsedEnvelope.status !== "draft") throw new Error("Envelope must be draft");

	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(10)
	).map((recipient) => RecipientSchema.parse(recipient));
	const recipientIds = new Set(recipients.map((recipient) => recipient.id));
	if (input.fields.some((field) => !recipientIds.has(field.recipientId))) {
		throw new Error("Field recipient not found");
	}

	const rows = await db
		.insert(envelopeFields)
		.values(input.fields.map((field) => ({ ...field, envelopeId })))
		.returning();
	return rows.map((field) => EnvelopeFieldSchema.parse(field));
}
