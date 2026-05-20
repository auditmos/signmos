import { z } from "zod";
import { envelopeStatuses, recipientStatuses } from "./table";

export const envelopeLifecycleActions = ["send"] as const;

export const EnvelopeStatusSchema = z.enum(envelopeStatuses);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export const RecipientStatusSchema = z.enum(recipientStatuses);
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>;

export const EnvelopeLifecycleActionSchema = z.enum(envelopeLifecycleActions);
export type EnvelopeLifecycleAction = z.infer<typeof EnvelopeLifecycleActionSchema>;

export const EnvelopeSchema = z.object({
	id: z.string().uuid(),
	status: EnvelopeStatusSchema,
	createdBy: z.string().min(1),
	createdAt: z.date(),
	sentBy: z.string().nullable().optional(),
	sentAt: z.date().nullable().optional(),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

export const CreateEnvelopeInputSchema = z.object({
	createdBy: z.string().min(1),
	idempotencyKey: z.string().min(1).optional(),
});
export type CreateEnvelopeInput = z.infer<typeof CreateEnvelopeInputSchema>;

export const EnvelopeResponseSchema = z.object({
	id: z.string().uuid(),
	status: EnvelopeStatusSchema,
	createdBy: z.string(),
	createdAt: z.string(),
});
export type EnvelopeResponse = z.infer<typeof EnvelopeResponseSchema>;

export const EnvelopeActionRequestSchema = z.object({
	action: EnvelopeLifecycleActionSchema,
});
export type EnvelopeActionInput = z.infer<typeof EnvelopeActionRequestSchema>;

export const SourceDocumentSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	r2Key: z.string().min(1),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	byteSize: z.coerce.number().int().nonnegative(),
	contentType: z.literal("application/pdf"),
	uploadedBy: z.string().min(1),
	uploadedAt: z.date(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const AttachSourceDocumentInputSchema = z.object({
	envelopeId: z.string().uuid(),
	uploadedBy: z.string().min(1),
	idempotencyKey: z.string().min(1).optional(),
	r2Key: z.string().min(1),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	byteSize: z.number().int().nonnegative(),
	contentType: z.literal("application/pdf"),
});
export type AttachSourceDocumentInput = z.infer<typeof AttachSourceDocumentInputSchema>;

export const SourceDocumentResponseSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	r2Key: z.string(),
	sha256: z.string(),
	byteSize: z.number(),
	contentType: z.literal("application/pdf"),
	uploadedBy: z.string(),
	uploadedAt: z.string(),
});
export type SourceDocumentResponse = z.infer<typeof SourceDocumentResponseSchema>;

export const RecipientSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	name: z.string().min(1),
	email: z.string().email(),
	status: RecipientStatusSchema,
	createdAt: z.date(),
});
export type Recipient = z.infer<typeof RecipientSchema>;

export const RecipientCreateSchema = z.object({
	name: z.string().min(1).max(120),
	email: z.string().email(),
});
export type RecipientCreateInput = z.infer<typeof RecipientCreateSchema>;

export const AddRecipientsRequestSchema = z.object({
	recipients: z.array(RecipientCreateSchema).min(1).max(10),
});
export type AddRecipientsRequest = z.infer<typeof AddRecipientsRequestSchema>;

export const RecipientResponseSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	name: z.string(),
	email: z.string(),
	status: RecipientStatusSchema,
	createdAt: z.string(),
});
export type RecipientResponse = z.infer<typeof RecipientResponseSchema>;

export const SendEnvelopeResultSchema = z.object({
	envelopeId: z.string().uuid(),
	status: z.literal("sent"),
	sentBy: z.string().min(1),
	tokenCount: z.number().int().nonnegative(),
	emailSendCount: z.number().int().nonnegative(),
});
export type SendEnvelopeResult = z.infer<typeof SendEnvelopeResultSchema>;

export const ResendInvitationResultSchema = z.object({
	recipientId: z.string().uuid(),
	email: z.string().email(),
	emailSendCount: z.number().int().positive(),
});
export type ResendInvitationResult = z.infer<typeof ResendInvitationResultSchema>;

export const SignerTokenSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	recipientId: z.string().uuid(),
	token: z.string().min(1),
	status: z.literal("active"),
	expiresAt: z.date(),
	createdAt: z.date(),
});
export type SignerToken = z.infer<typeof SignerTokenSchema>;

export function toEnvelopeResponse(envelope: Envelope): EnvelopeResponse {
	return {
		id: envelope.id,
		status: envelope.status,
		createdBy: envelope.createdBy,
		createdAt: envelope.createdAt.toISOString(),
	};
}

export function toSourceDocumentResponse(document: SourceDocument): SourceDocumentResponse {
	return {
		id: document.id,
		envelopeId: document.envelopeId,
		r2Key: document.r2Key,
		sha256: document.sha256,
		byteSize: document.byteSize,
		contentType: document.contentType,
		uploadedBy: document.uploadedBy,
		uploadedAt: document.uploadedAt.toISOString(),
	};
}

export function toRecipientResponse(recipient: Recipient): RecipientResponse {
	return {
		id: recipient.id,
		envelopeId: recipient.envelopeId,
		name: recipient.name,
		email: recipient.email,
		status: recipient.status,
		createdAt: recipient.createdAt.toISOString(),
	};
}
