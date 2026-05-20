import { z } from "zod";
import { envelopeStatuses, fieldTypes, recipientStatuses } from "./table";

export const envelopeLifecycleActions = ["send"] as const;

export const EnvelopeStatusSchema = z.enum(envelopeStatuses);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export const RecipientStatusSchema = z.enum(recipientStatuses);
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>;

export const FieldTypeSchema = z.enum(fieldTypes);
export type FieldType = z.infer<typeof FieldTypeSchema>;

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

export const FinalDocumentSchema = z.object({
	id: z.string().uuid().optional(),
	envelopeId: z.string().uuid(),
	r2Key: z.string().min(1),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	byteSize: z.coerce.number().int().nonnegative(),
	contentType: z.literal("application/pdf"),
	createdAt: z.date().optional(),
});
export type FinalDocument = z.infer<typeof FinalDocumentSchema>;

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

export const SignerSessionSchema = z.object({
	envelopeId: z.string().uuid(),
	recipientId: z.string().uuid(),
	fields: z.array(
		z.object({
			id: z.string().uuid(),
			type: FieldTypeSchema,
			page: z.number(),
			x: z.number(),
			y: z.number(),
			width: z.number(),
			height: z.number(),
		}),
	),
});
export type SignerSession = z.infer<typeof SignerSessionSchema>;

export const CompleteSigningRequestSchema = z.object({
	signatureName: z.string().min(1),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CompleteSigningRequest = z.infer<typeof CompleteSigningRequestSchema>;

export const CompleteSigningResultSchema = z.object({
	envelopeId: z.string().uuid(),
	recipientId: z.string().uuid(),
	recipientStatus: z.literal("completed"),
	envelopeStatus: EnvelopeStatusSchema,
});
export type CompleteSigningResult = z.infer<typeof CompleteSigningResultSchema>;

export const DeclineSigningRequestSchema = z.object({
	reason: z.string().min(1),
	comment: z.string().min(1).optional(),
});
export type DeclineSigningRequest = z.infer<typeof DeclineSigningRequestSchema>;

export const DeclineSigningResultSchema = z.object({
	envelopeId: z.string().uuid(),
	recipientId: z.string().uuid(),
	recipientStatus: z.literal("declined"),
	envelopeStatus: z.literal("declined"),
});
export type DeclineSigningResult = z.infer<typeof DeclineSigningResultSchema>;

export const EnvelopeFieldSchema = z.object({
	id: z.string().uuid(),
	envelopeId: z.string().uuid(),
	recipientId: z.string().uuid(),
	type: FieldTypeSchema,
	page: z.coerce.number().int().min(1),
	x: z.coerce.number().int().min(0),
	y: z.coerce.number().int().min(0),
	width: z.coerce.number().int().positive(),
	height: z.coerce.number().int().positive(),
	createdAt: z.date(),
});
export type EnvelopeField = z.infer<typeof EnvelopeFieldSchema>;

export const FieldCreateSchema = z.object({
	recipientId: z.string().uuid(),
	type: FieldTypeSchema,
	page: z.number().int().min(1),
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
});
export type FieldCreateInput = z.infer<typeof FieldCreateSchema>;

export const AddFieldsRequestSchema = z.object({
	fields: z.array(FieldCreateSchema).min(1),
});
export type AddFieldsRequest = z.infer<typeof AddFieldsRequestSchema>;

export const EnvelopeFieldResponseSchema = EnvelopeFieldSchema.extend({
	createdAt: z.string(),
});
export type EnvelopeFieldResponse = z.infer<typeof EnvelopeFieldResponseSchema>;

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

export function toEnvelopeFieldResponse(field: EnvelopeField): EnvelopeFieldResponse {
	return {
		id: field.id,
		envelopeId: field.envelopeId,
		recipientId: field.recipientId,
		type: field.type,
		page: field.page,
		x: field.x,
		y: field.y,
		width: field.width,
		height: field.height,
		createdAt: field.createdAt.toISOString(),
	};
}
