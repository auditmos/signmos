import { z } from "zod";
import {
	AgentPartnerChangeRequestSchema,
	AgentPartnerChangeResponseSchema,
	AgentPartnerDeclineRequestSchema,
	AgentPartnerDeclineResponseSchema,
	agentPartnerOperations,
} from "@/db/agentic-access/partner-signing-schema";
import {
	AgentDocumentErrorSchema,
	AgentV1AuthenticationErrorSchema,
} from "@/db/agentic-access/schema";
import { agentRateLimitErrorResponse } from "./public-agent-rate-limit-contract";

const documentIdParameter = {
	name: "documentId",
	in: "path",
	required: true,
	schema: { type: "string", format: "uuid" },
};

export function buildAgentPartnerPaths() {
	return {
		[agentPartnerOperations.changeRequest.publicPath]: {
			post: commandOperation({
				operationId: agentPartnerOperations.changeRequest.operationId,
				summary: "Request creator revision with a required partner comment",
				requestSchema: AgentPartnerChangeRequestSchema,
				responseSchema: AgentPartnerChangeResponseSchema,
			}),
		},
		[agentPartnerOperations.decline.publicPath]: {
			post: commandOperation({
				operationId: agentPartnerOperations.decline.operationId,
				summary: "Decline partner signing with a required reason",
				requestSchema: AgentPartnerDeclineRequestSchema,
				responseSchema: AgentPartnerDeclineResponseSchema,
			}),
		},
	};
}

export const agentPartnerGuidance = `
## Discover invited signing work

Use the catalog with the signer role and needs_my_action group. A personal Bearer token is verification-equivalent for the same normalized invited email; never request or expose a process signing token.

## Review only assigned content

GET the signing task, source PDF, and fields through the documented Agent API routes. Partner task and field responses contain only fields assigned to the verified email and only while signing is active.

## Complete partner signing

POST a typed or drawn signature to the completion command. The server fixes the date, and reusable signature content is stored only when rememberSignature is true.

## Request creator changes

POST a non-empty comment to the change-request command. This notifies the creator, moves the document to changes_requested, and blocks signing until a revised invitation is active.

## Decline partner signing

POST a required reason and optional comment to decline. Decline is terminal and all later signing commands are rejected.

## Poll after a partner decision

Poll the document status after completion or a decision. When completion makes the document completed, both creator and signer identities can download the final PDF.

## Signing-state recovery

Follow each error's allowedActions and recoveryUrl. Wrong identity, inactive, completed, changes requested, declined, expired, deleted, revoked token, and invalid input are stable machine-readable states. Exact command retries use the same Idempotency-Key; changed intent uses a fresh key.
`;

function commandOperation(input: {
	operationId: string;
	summary: string;
	requestSchema: z.ZodType;
	responseSchema: z.ZodType;
}) {
	return {
		operationId: input.operationId,
		summary: input.summary,
		security: [{ bearerAuth: [] }],
		parameters: [documentIdParameter, idempotencyKeyParameter()],
		requestBody: {
			required: true,
			content: { "application/json": { schema: z.toJSONSchema(input.requestSchema) } },
		},
		responses: {
			"200": {
				description: "Command completed or exact result replayed",
				content: { "application/json": { schema: z.toJSONSchema(input.responseSchema) } },
			},
			...errorResponses(),
		},
	};
}

function errorResponses() {
	const error = (description: string) => ({
		description,
		content: { "application/json": { schema: z.toJSONSchema(AgentDocumentErrorSchema) } },
	});
	return {
		"400": error("Invalid decision input"),
		"401": {
			description: "Missing, revoked, or invalid Bearer token",
			content: {
				"application/json": { schema: z.toJSONSchema(AgentV1AuthenticationErrorSchema) },
			},
		},
		"403": error("Verified identity is not the invited partner"),
		"404": error("Signing task was not found"),
		"409": error("Signing state or idempotency conflict"),
		"410": error("Signing task is terminal"),
		"429": agentRateLimitErrorResponse(),
		"502": error("Configured delivery provider rejected the notification"),
	};
}

function idempotencyKeyParameter() {
	return {
		name: "Idempotency-Key",
		in: "header",
		required: true,
		schema: { type: "string", minLength: 1, maxLength: 200 },
	};
}
