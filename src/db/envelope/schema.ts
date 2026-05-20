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

export function toEnvelopeResponse(envelope: Envelope): EnvelopeResponse {
	return {
		id: envelope.id,
		status: envelope.status,
		createdBy: envelope.createdBy,
		createdAt: envelope.createdAt.toISOString(),
	};
}
