import { z } from "zod";
import { EnvelopeStatusSchema } from "@/db/envelope/schema";

export const AgentCreatorControlRequestSchema = z.object({
	action: z.enum(["cancel", "expire", "delete"]),
});

export const AgentCreatorControlResponseSchema = z.object({
	data: z.object({
		envelopeId: z.string().uuid(),
		action: z.enum(["cancel", "expire", "delete"]),
		status: EnvelopeStatusSchema,
		allowedActions: z.array(z.string()),
	}),
});

export const AgentCreatorRetentionResponseSchema = z.object({
	data: z.object({
		envelopeId: z.string().uuid(),
		status: EnvelopeStatusSchema,
		retentionEligibleAt: z.string().datetime().nullable(),
		retentionEligible: z.boolean(),
	}),
});

export const agentCreatorControlOperations = {
	action: operation(
		"post",
		"/documents/:documentId/actions",
		"/api/v1/documents/{documentId}/actions",
		"controlAgentDocument",
	),
	retention: operation(
		"get",
		"/documents/:documentId/retention",
		"/api/v1/documents/{documentId}/retention",
		"getAgentDocumentRetention",
	),
} as const;

function operation(
	method: "get" | "post",
	relativePath: string,
	publicPath: string,
	operationId: string,
) {
	return { method, relativePath, publicPath, operationId } as const;
}
