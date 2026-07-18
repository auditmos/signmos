import { z } from "zod";
import {
	AgentCreatorControlRequestSchema,
	AgentCreatorControlResponseSchema,
	AgentCreatorRetentionResponseSchema,
	agentCreatorControlOperations,
} from "@/db/agentic-access/creator-controls-schema";
import {
	AgentDocumentErrorSchema,
	AgentV1AuthenticationErrorSchema,
} from "@/db/agentic-access/schema";

const documentIdParameter = {
	name: "documentId",
	in: "path",
	required: true,
	schema: { type: "string", format: "uuid" },
};

export function buildAgentCreatorControlPaths() {
	return {
		[agentCreatorControlOperations.action.publicPath]: {
			post: {
				operationId: agentCreatorControlOperations.action.operationId,
				summary: "Cancel, expire, or delete a creator-owned document",
				security: [{ bearerAuth: [] }],
				parameters: [documentIdParameter, idempotencyKeyParameter()],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: z.toJSONSchema(AgentCreatorControlRequestSchema),
						},
					},
				},
				responses: successAndErrors(AgentCreatorControlResponseSchema),
			},
		},
		[agentCreatorControlOperations.retention.publicPath]: {
			get: {
				operationId: agentCreatorControlOperations.retention.operationId,
				summary: "Inspect creator-only terminal retention eligibility",
				security: [{ bearerAuth: [] }],
				parameters: [documentIdParameter],
				responses: successAndErrors(AgentCreatorRetentionResponseSchema),
			},
		},
	};
}

export const agentCreatorControlGuidance = `
## Recover from requested changes

Inspect document detail and history to read the first partner comment, current changes_requested status, and server-derived recovery actions. Only the creator identity can run the recovery commands.

## Upload a revision

PUT a valid PDF to the source command while changes_requested. The new version becomes current, old signer authority is revoked, and the response preserves version, hash, byte size, filename, and storage-safe metadata.

## Replace cleared fields

A revision clears every prior field and value and resets recipients for fresh signing. Place new fields for every recipient, complete creator signing again, then use the send command to deliver one fresh partner invitation.

## Cancel or expire

POST cancel or expire only when current allowedActions permit it. Both stop outstanding signing and return the terminal expired status; exact retries reuse the same Idempotency-Key.

## Delete and revoke

Delete removes stored source/final artifacts and immediately removes the document from Bearer and My Documents catalogs. Creator, signer, process-link, history-session, detail, PDF, and action paths must all treat it as deleted or not found.

## Inspect retention

Creators can GET the retention projection. Completed and expired documents become eligible exactly 90 days after the recorded terminal timestamp; signer-only and unrelated identities cannot use this creator route.
`;

function successAndErrors(responseSchema: z.ZodType) {
	const error = (description: string) => ({
		description,
		content: { "application/json": { schema: z.toJSONSchema(AgentDocumentErrorSchema) } },
	});
	return {
		"200": {
			description: "Authorized creator result or exact replay",
			content: { "application/json": { schema: z.toJSONSchema(responseSchema) } },
		},
		"400": error("Invalid creator command"),
		"401": {
			description: "Missing, revoked, or invalid Bearer token",
			content: {
				"application/json": { schema: z.toJSONSchema(AgentV1AuthenticationErrorSchema) },
			},
		},
		"404": error("Document is not creator-owned or was deleted"),
		"409": error("Lifecycle or idempotency precondition failed"),
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
