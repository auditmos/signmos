import { z } from "zod";
import { envelopeStatuses } from "./table";

export const envelopeLifecycleActions = ["send"] as const;

export const EnvelopeStatusSchema = z.enum(envelopeStatuses);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export const EnvelopeLifecycleActionSchema = z.enum(envelopeLifecycleActions);
export type EnvelopeLifecycleAction = z.infer<typeof EnvelopeLifecycleActionSchema>;

export const EnvelopeSchema = z.object({
	id: z.string().uuid(),
	status: EnvelopeStatusSchema,
	createdBy: z.string().min(1),
	createdAt: z.date(),
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
