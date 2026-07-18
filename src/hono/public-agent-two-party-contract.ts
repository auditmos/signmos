import { z } from "zod";
import {
	AgentDocumentErrorSchema,
	AgentEmptyCommandRequestSchema,
	AgentRecipientCreateSchema,
	AgentRecipientResponseSchema,
	AgentRecipientsAddRequestSchema,
	AgentRecipientsResponseSchema,
	AgentTwoPartyResendResponseSchema,
	AgentTwoPartySendResponseSchema,
	AgentV1AuthenticationErrorSchema,
	agentTwoPartyOperations,
} from "@/db/agentic-access/schema";
import { agentRateLimitErrorResponse } from "./public-agent-rate-limit-contract";

const documentIdParameter = pathParameter("documentId");
const recipientIdParameter = pathParameter("recipientId");

export function buildAgentTwoPartyPaths() {
	return {
		[agentTwoPartyOperations.recipientsList.publicPath]: {
			get: jsonReadOperation(
				agentTwoPartyOperations.recipientsList.operationId,
				"List creator-managed recipients and current states",
				AgentRecipientsResponseSchema,
				[documentIdParameter],
			),
			post: commandOperation({
				operationId: agentTwoPartyOperations.recipientsAdd.operationId,
				summary: "Add normalized draft recipients within the 10-recipient limit",
				requestSchema: AgentRecipientsAddRequestSchema,
				responseSchema: AgentRecipientsResponseSchema,
				responseStatus: "201",
				parameters: [documentIdParameter],
			}),
		},
		[agentTwoPartyOperations.recipientUpdate.publicPath]: {
			patch: commandOperation({
				operationId: agentTwoPartyOperations.recipientUpdate.operationId,
				summary: "Update one partner recipient while the document is draft",
				requestSchema: AgentRecipientCreateSchema,
				responseSchema: AgentRecipientResponseSchema,
				responseStatus: "200",
				parameters: [documentIdParameter, recipientIdParameter],
			}),
			delete: commandOperation({
				operationId: agentTwoPartyOperations.recipientDelete.operationId,
				summary: "Delete one partner recipient while the document is draft",
				requestSchema: AgentEmptyCommandRequestSchema,
				responseSchema: AgentRecipientResponseSchema,
				responseStatus: "200",
				parameters: [documentIdParameter, recipientIdParameter],
			}),
		},
		[agentTwoPartyOperations.send.publicPath]: {
			post: commandOperation({
				operationId: agentTwoPartyOperations.send.operationId,
				summary: "Send a prepared, creator-signed document to eligible partners",
				requestSchema: AgentEmptyCommandRequestSchema,
				responseSchema: AgentTwoPartySendResponseSchema,
				responseStatus: "200",
				parameters: [documentIdParameter],
			}),
		},
		[agentTwoPartyOperations.resend.publicPath]: {
			post: commandOperation({
				operationId: agentTwoPartyOperations.resend.operationId,
				summary: "Issue and deliver a fresh eligible partner invitation",
				requestSchema: AgentEmptyCommandRequestSchema,
				responseSchema: AgentTwoPartyResendResponseSchema,
				responseStatus: "201",
				parameters: [documentIdParameter, recipientIdParameter],
			}),
		},
	};
}

function commandOperation(input: {
	operationId: string;
	summary: string;
	requestSchema: z.ZodType;
	responseSchema: z.ZodType;
	responseStatus: "200" | "201";
	parameters: Array<Record<string, unknown>>;
}) {
	return {
		operationId: input.operationId,
		summary: input.summary,
		security: [{ bearerAuth: [] }],
		parameters: [...input.parameters, idempotencyKeyParameter()],
		requestBody: {
			required: true,
			content: { "application/json": { schema: z.toJSONSchema(input.requestSchema) } },
		},
		responses: {
			[input.responseStatus]: {
				description: "Command completed or exact result replayed",
				content: { "application/json": { schema: z.toJSONSchema(input.responseSchema) } },
			},
			...errorResponses(),
		},
	};
}

function jsonReadOperation(
	operationId: string,
	summary: string,
	responseSchema: z.ZodType,
	parameters: Array<Record<string, unknown>>,
) {
	return {
		operationId,
		summary,
		security: [{ bearerAuth: [] }],
		parameters,
		responses: {
			"200": {
				description: "Authorized creator projection",
				content: { "application/json": { schema: z.toJSONSchema(responseSchema) } },
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
		"400": error("Invalid request"),
		"401": {
			description: "Missing, revoked, or invalid Bearer token",
			content: {
				"application/json": { schema: z.toJSONSchema(AgentV1AuthenticationErrorSchema) },
			},
		},
		"404": error("Document or recipient is not visible to this identity"),
		"409": error("Lifecycle or idempotency precondition failed"),
		"429": agentRateLimitErrorResponse(),
		"502": error("Configured delivery provider rejected the invitation"),
	};
}

function pathParameter(name: string) {
	return { name, in: "path", required: true, schema: { type: "string", format: "uuid" } };
}

function idempotencyKeyParameter() {
	return {
		name: "Idempotency-Key",
		in: "header",
		required: true,
		schema: { type: "string", minLength: 1, maxLength: 200 },
	};
}
