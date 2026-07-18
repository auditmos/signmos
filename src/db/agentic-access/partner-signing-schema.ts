import { z } from "zod";
import {
	ChangeRequestSigningRequestSchema,
	ChangeRequestSigningResultSchema,
	DeclineSigningRequestSchema,
	DeclineSigningResultSchema,
} from "@/db/envelope/schema";

export const AgentPartnerChangeRequestSchema = ChangeRequestSigningRequestSchema;
export const AgentPartnerChangeResponseSchema = z.object({
	data: ChangeRequestSigningResultSchema,
});
export const AgentPartnerDeclineRequestSchema = DeclineSigningRequestSchema;
export const AgentPartnerDeclineResponseSchema = z.object({ data: DeclineSigningResultSchema });

export const agentPartnerOperations = {
	changeRequest: operation(
		"/documents/:documentId/change-request",
		"/api/v1/documents/{documentId}/change-request",
		"requestAgentSigningChanges",
	),
	decline: operation(
		"/documents/:documentId/decline",
		"/api/v1/documents/{documentId}/decline",
		"declineAgentSigning",
	),
} as const;

function operation(relativePath: string, publicPath: string, operationId: string) {
	return { method: "post", relativePath, publicPath, operationId } as const;
}
