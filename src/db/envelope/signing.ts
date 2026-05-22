import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { finalizeCompletedEnvelope } from "./finalization";
import {
	type CompleteSigningRequest,
	type CompleteSigningResult,
	type CompleteSigningSignature,
	type DeclineSigningRequest,
	type DeclineSigningResult,
	type Envelope,
	EnvelopeFieldSchema,
	EnvelopeSchema,
	getEnvelopeAllowedActions,
	type Recipient,
	RecipientSchema,
	SignatureProfileSchema,
	type SignerSession,
	type SignerToken,
	SignerTokenSchema,
	type SourceDocument,
	SourceDocumentSchema,
	toSignatureProfileResponse,
} from "./schema";
import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	signatureProfiles,
	signerTokens,
	sourceDocuments,
} from "./table";

export class SigningCompletionBlockedError extends Error {
	constructor(public readonly status: Envelope["status"]) {
		super("Envelope is not open for completion");
		this.name = "SigningCompletionBlockedError";
	}
}

export class SigningNoAssignedFieldsError extends Error {
	constructor() {
		super("No signing fields are assigned to this recipient");
		this.name = "SigningNoAssignedFieldsError";
	}
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
	const sourceDocumentsForEnvelope = (
		await db
			.select()
			.from(sourceDocuments)
			.where(eq(sourceDocuments.envelopeId, token.envelopeId))
			.limit(100)
	).map((document) => SourceDocumentSchema.parse(document));
	const sourceDocument = latestSourceDocument(sourceDocumentsForEnvelope);
	if (!sourceDocument) throw new Error("Envelope source PDF required");
	const recipient = await getRecipientForSigner(token.recipientId);
	const signaturePreference = recipient
		? await getLatestSignaturePreferenceForEmail(recipient.email)
		: null;

	await db
		.insert(auditEvents)
		.values({
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			eventType: "partner.signing.viewed",
			message: null,
		})
		.returning();

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		sourceDocument: {
			version: sourceDocument.version,
			contentType: sourceDocument.contentType,
			downloadUrl: `/api/signing/${token.token}/source-pdf`,
		},
		fields: fields.map((field) => ({
			id: field.id,
			type: field.type,
			page: field.page,
			x: field.x,
			y: field.y,
			width: field.width,
			height: field.height,
		})),
		signaturePreference: signaturePreference
			? toSignatureProfileResponse(signaturePreference)
			: null,
	};
}

export async function getSignerSourceDocument(token: SignerToken): Promise<SourceDocument | null> {
	const db = getDb();
	const documents = (
		await db
			.select()
			.from(sourceDocuments)
			.where(eq(sourceDocuments.envelopeId, token.envelopeId))
			.limit(100)
	).map((document) => SourceDocumentSchema.parse(document));
	return latestSourceDocument(documents);
}

export async function completeSigning(
	token: SignerToken,
	input: CompleteSigningRequest,
	options: { documentsBucket?: R2Bucket } = {},
): Promise<CompleteSigningResult> {
	const db = getDb();
	const signature = normalizeSigningSignature(input);
	const [envelope] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, token.envelopeId))
		.limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	if (parsedEnvelope.status !== "sent") {
		throw new SigningCompletionBlockedError(parsedEnvelope.status);
	}

	const fields = (
		await db
			.select()
			.from(envelopeFields)
			.where(eq(envelopeFields.recipientId, token.recipientId))
			.limit(100)
	).map((field) => EnvelopeFieldSchema.parse(field));
	if (fields.length === 0) throw new SigningNoAssignedFieldsError();

	await db
		.insert(fieldValues)
		.values(
			fields.map((field) => ({
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				fieldId: field.id,
				value: field.type === "signature" ? signature.fieldValue : input.date,
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
				message: signature.auditMessage,
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
	const signingRecipient = recipients.find((recipient) => recipient.id === token.recipientId);
	if (input.rememberSignature && signingRecipient) {
		await rememberPartnerSignaturePreference({
			envelopeId: token.envelopeId,
			email: signingRecipient.email,
			signature,
		});
	}
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
		await db
			.insert(emailSendRecords)
			.values({
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				tokenId: token.id,
				email: parsedEnvelope.createdBy,
				kind: "partner_signed",
				fallbackUrl: buildSenderSigningNotificationUrl(token.envelopeId),
			})
			.returning();
		await finalizeCompletedEnvelope(token.envelopeId, options);
	}

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		recipientStatus: "completed",
		envelopeStatus,
	};
}

export function getSigningBlockedAllowedActions(status: Envelope["status"]): string[] {
	return getEnvelopeAllowedActions(status);
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

type NormalizedSigningSignature =
	| {
			kind: "typed";
			fieldValue: string;
			auditMessage: string;
			typedText: string;
			typedFont: string;
	  }
	| {
			kind: "drawn";
			fieldValue: string;
			auditMessage: string;
			label: string;
			svgPath: string;
	  };

function normalizeSigningSignature(input: CompleteSigningRequest): NormalizedSigningSignature {
	const signature = input.signature ?? legacyTypedSigningSignature(input.signatureName);
	if (signature.kind === "typed") {
		return {
			kind: "typed",
			fieldValue: signature.typedText,
			auditMessage: signature.typedText,
			typedText: signature.typedText,
			typedFont: signature.typedFont,
		};
	}
	return {
		kind: "drawn",
		fieldValue: signature.svgPath,
		auditMessage: signature.label,
		label: signature.label,
		svgPath: signature.svgPath,
	};
}

function legacyTypedSigningSignature(signatureName: string | undefined): CompleteSigningSignature {
	const typedText = signatureName?.trim();
	if (!typedText) throw new Error("Signature is required");
	return {
		kind: "typed",
		typedText,
		typedFont: "cursive",
	};
}

async function rememberPartnerSignaturePreference(input: {
	envelopeId: string;
	email: string;
	signature: NormalizedSigningSignature;
}): Promise<void> {
	const db = getDb();
	await db
		.insert(signatureProfiles)
		.values(
			input.signature.kind === "typed"
				? {
						envelopeId: input.envelopeId,
						createdBy: normalizeSignatureProfileActor(input.email),
						kind: "typed",
						label: "Typed signature",
						svgPath: null,
						typedText: input.signature.typedText,
						typedFont: input.signature.typedFont,
						selected: true,
					}
				: {
						envelopeId: input.envelopeId,
						createdBy: normalizeSignatureProfileActor(input.email),
						kind: "drawn",
						label: input.signature.label,
						svgPath: input.signature.svgPath,
						typedText: null,
						typedFont: null,
						selected: true,
					},
		)
		.returning();
}

async function getRecipientForSigner(recipientId: string): Promise<Recipient | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(envelopeRecipients)
		.where(eq(envelopeRecipients.id, recipientId))
		.limit(10);
	const recipients = rows.map((recipient) => RecipientSchema.parse(recipient));
	return recipients.find((recipient) => recipient.id === recipientId) ?? null;
}

async function getLatestSignaturePreferenceForEmail(email: string) {
	const db = getDb();
	const normalizedEmail = normalizeSignatureProfileActor(email);
	const profiles = (
		await db
			.select()
			.from(signatureProfiles)
			.where(eq(signatureProfiles.createdBy, normalizedEmail))
			.limit(100)
	).map((profile) => SignatureProfileSchema.parse(profile));
	return (
		profiles
			.filter(
				(profile) =>
					normalizeSignatureProfileActor(profile.createdBy) === normalizedEmail && profile.selected,
			)
			.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
	);
}

function latestSourceDocument(documents: SourceDocument[]): SourceDocument | null {
	return [...documents].sort((left, right) => right.version - left.version)[0] ?? null;
}

function buildSenderSigningNotificationUrl(envelopeId: string): string {
	return `/envelope-fields?envelopeId=${envelopeId}`;
}

function normalizeSignatureProfileActor(actor: string): string {
	return actor.trim().toLowerCase();
}
