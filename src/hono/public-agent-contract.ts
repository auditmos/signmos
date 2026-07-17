import { z } from "zod";
import {
	AgentDocumentErrorSchema,
	AgentDocumentGroupSchema,
	AgentDocumentRoleSchema,
	AgentV1AuthenticationErrorSchema,
	agentDocumentOperations,
	agentV1IdentityOperation,
} from "@/db/agentic-access/schema";
import { EnvelopeStatusSchema } from "@/db/envelope/schema";
import { createHono } from "./factory";

export const publicAgentContractHono = createHono();

publicAgentContractHono.get("/agent.md", (c) =>
	c.text(buildAgentGuidance(), 200, { "content-type": "text/markdown; charset=UTF-8" }),
);

publicAgentContractHono.get("/openapi.json", (c) => c.json(buildAgentOpenApiDocument()));

function buildAgentOpenApiDocument() {
	const documentIdParameter = {
		name: "documentId",
		in: "path",
		required: true,
		schema: { type: "string", format: "uuid" },
	};
	return {
		openapi: "3.1.0",
		info: {
			title: "Signmos Agent API",
			version: "1.0.0",
			description: "Bearer-authenticated personal document automation for Signmos.",
		},
		paths: {
			[agentV1IdentityOperation.publicPath]: {
				get: jsonOperation({
					operationId: agentV1IdentityOperation.operationId,
					summary: "Resolve the current verified Agentic identity",
					responseDescription: "Authenticated identity and safe token metadata",
					responseSchema: agentV1IdentityOperation.responseSchema,
					documentErrors: false,
				}),
			},
			[agentDocumentOperations.catalog.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentDocumentOperations.catalog.operationId,
						summary: "List retained documents available to the verified identity",
						responseDescription: "Role-aware, action-first document catalog",
						responseSchema: agentDocumentOperations.catalog.responseSchema,
					}),
					parameters: catalogParameters(),
				},
			},
			[agentDocumentOperations.detail.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentDocumentOperations.detail.operationId,
						summary: "Inspect authorized document detail",
						responseDescription: "Lifecycle, role, retention, actions, and public history",
						responseSchema: agentDocumentOperations.detail.responseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentDocumentOperations.status.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentDocumentOperations.status.operationId,
						summary: "Poll authorized document lifecycle status",
						responseDescription: "Current status and server-derived allowed actions",
						responseSchema: agentDocumentOperations.status.responseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentDocumentOperations.history.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentDocumentOperations.history.operationId,
						summary: "Read authorized user-facing document history",
						responseDescription: "Public lifecycle history without internal security events",
						responseSchema: agentDocumentOperations.history.responseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentDocumentOperations.finalPdf.publicPath]: {
				get: {
					operationId: agentDocumentOperations.finalPdf.operationId,
					summary: "Download an authorized completed final PDF",
					security: [{ bearerAuth: [] }],
					parameters: [documentIdParameter],
					responses: {
						"200": {
							description: "Final PDF bytes",
							content: {
								"application/pdf": { schema: { type: "string", format: "binary" } },
							},
						},
						...agentErrorResponses(),
					},
				},
			},
		},
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "SignmosToken" },
			},
		},
	};
}

function jsonOperation(input: {
	operationId: string;
	summary: string;
	responseDescription: string;
	responseSchema: z.ZodType;
	documentErrors?: boolean;
}) {
	return {
		operationId: input.operationId,
		summary: input.summary,
		security: [{ bearerAuth: [] }],
		responses: {
			"200": {
				description: input.responseDescription,
				content: {
					"application/json": { schema: z.toJSONSchema(input.responseSchema) },
				},
			},
			...(input.documentErrors === false
				? { "401": agentErrorResponses()["401"] }
				: agentErrorResponses()),
		},
	};
}

function agentErrorResponses() {
	return {
		"400": agentErrorResponse("Invalid query"),
		"401": {
			description: "Missing, revoked, or invalid Bearer token",
			content: {
				"application/json": { schema: z.toJSONSchema(AgentV1AuthenticationErrorSchema) },
			},
		},
		"404": agentErrorResponse("Document is not visible to this identity"),
		"409": agentErrorResponse("Final PDF is not ready"),
		"503": agentErrorResponse("Final PDF object is temporarily unavailable"),
	};
}

function agentErrorResponse(description: string) {
	return {
		description,
		content: { "application/json": { schema: z.toJSONSchema(AgentDocumentErrorSchema) } },
	};
}

function catalogParameters() {
	return [
		queryParameter("search", z.string().max(200)),
		queryParameter("role", AgentDocumentRoleSchema),
		queryParameter("group", AgentDocumentGroupSchema),
		queryParameter("status", EnvelopeStatusSchema.exclude(["deleted"])),
		queryParameter("page", z.number().int().positive()),
	];
}

function queryParameter(name: string, schema: z.ZodType) {
	return { name, in: "query", required: false, schema: z.toJSONSchema(schema) };
}

function buildAgentGuidance(): string {
	return `# Signmos Agent API

Read this guide and [/openapi.json](/openapi.json) before acting. Signmos Agentic tokens represent one verified email. Use only documented operations and stay within the user goal.

## Secret handling

Provide the token through the SIGNMOS_TOKEN environment variable. Never paste it into prompts, URLs, issue bodies, source control, or logs. Send it only in the Authorization: Bearer $SIGNMOS_TOKEN header.

## Confirm identity

Call GET /api/v1/me first and confirm the normalized verified email before reading documents.

## Discover documents

Call GET /api/v1/documents. Search and combine role, group, status, and page filters. Catalog order puts documents needing action first. Begin from this catalog; never probe guessed IDs.

## Creator, signer, and dual roles

Each response reports creator, signer, or creator_and_signer plus server-derived allowed actions. Treat these as current lifecycle facts. This API phase is read-only even when an action is reported.

## Poll document status

Use GET /api/v1/documents/{documentId}/status and follow machine fields such as retryable, allowedActions, and recoveryUrl. Do not infer state from prose or poll undocumented routes.

## Inspect detail and history

Use the document detail and history routes for authorized lifecycle, retention, parties, and public events. Responses never contain browser cookies, process links, internal headers, or security-audit rows.

## Download a completed PDF

When download_final_pdf is allowed, request GET /api/v1/documents/{documentId}/pdf and accept application/pdf. A not-ready response may be polled through its recovery URL.

## Revoked, deleted, or unavailable

A revoked token returns 401 and must be replaced through fresh email verification. Deleted or unauthorized documents return the same 404 without revealing existence. An unavailable final object returns a retryable 503 with a safe recovery URL.
`;
}
