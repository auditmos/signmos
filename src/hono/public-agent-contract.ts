import { z } from "zod";
import {
	AgentDocumentErrorSchema,
	AgentDocumentGroupSchema,
	AgentDocumentRoleSchema,
	AgentSelfSignCompleteRequestSchema,
	AgentSelfSignCompleteResponseSchema,
	AgentSelfSignCreateRequestSchema,
	AgentSelfSignCreateResponseSchema,
	AgentSelfSignDefaultFieldsRequestSchema,
	AgentSelfSignFieldPlacementRequestSchema,
	AgentSelfSignFieldPlacementResponseSchema,
	AgentSelfSignFieldsRequestSchema,
	AgentSelfSignFieldsResponseSchema,
	AgentSelfSignTaskResponseSchema,
	AgentSignatureProfileCreateRequestSchema,
	AgentSignatureProfileResponseSchema,
	AgentSourcePdfResponseSchema,
	AgentV1AuthenticationErrorSchema,
	agentDocumentOperations,
	agentSelfSignOperations,
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
	const fieldIdParameter = {
		name: "fieldId",
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
				post: commandOperation({
					operationId: agentSelfSignOperations.create.operationId,
					summary: "Create a verified self-sign draft",
					requestSchema: AgentSelfSignCreateRequestSchema,
					responseSchema: AgentSelfSignCreateResponseSchema,
					responseStatus: "201",
				}),
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
			[agentSelfSignOperations.sourceUpload.publicPath]: {
				put: commandOperation({
					operationId: agentSelfSignOperations.sourceUpload.operationId,
					summary: "Upload the one source PDF for a self-sign draft",
					requestContent: {
						"application/pdf": { schema: { type: "string", format: "binary" } },
					},
					responseSchema: AgentSourcePdfResponseSchema,
					responseStatus: "201",
					parameters: [documentIdParameter, sourceFilenameParameter()],
				}),
				get: {
					...jsonOperation({
						operationId: agentSelfSignOperations.sourceMetadata.operationId,
						summary: "Inspect the authorized current source PDF metadata",
						responseDescription: "Current source PDF metadata and preparation URL",
						responseSchema: AgentSourcePdfResponseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentSelfSignOperations.sourceContent.publicPath]: {
				get: binaryReadOperation(
					agentSelfSignOperations.sourceContent.operationId,
					"Download the authorized source PDF for preparation",
					[documentIdParameter],
				),
			},
			[agentSelfSignOperations.profileCreate.publicPath]: {
				post: commandOperation({
					operationId: agentSelfSignOperations.profileCreate.operationId,
					summary: "Save a reusable typed or drawn signature with explicit consent",
					requestSchema: AgentSignatureProfileCreateRequestSchema,
					responseSchema: AgentSignatureProfileResponseSchema,
					responseStatus: "201",
					parameters: [documentIdParameter],
				}),
			},
			[agentSelfSignOperations.profileSelected.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentSelfSignOperations.profileSelected.operationId,
						summary: "Read the latest selected signature for this verified identity",
						responseDescription: "Selected signature profile or null",
						responseSchema: AgentSignatureProfileResponseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentSelfSignOperations.fieldsExplicit.publicPath]: {
				post: commandOperation({
					operationId: agentSelfSignOperations.fieldsExplicit.operationId,
					summary: "Place explicit self-sign signature/date fields",
					requestSchema: AgentSelfSignFieldsRequestSchema,
					responseSchema: AgentSelfSignFieldsResponseSchema,
					responseStatus: "201",
					parameters: [documentIdParameter],
				}),
			},
			[agentSelfSignOperations.fieldsDefault.publicPath]: {
				post: commandOperation({
					operationId: agentSelfSignOperations.fieldsDefault.operationId,
					summary: "Place default self-sign signature/date fields",
					requestSchema: AgentSelfSignDefaultFieldsRequestSchema,
					responseSchema: AgentSelfSignFieldsResponseSchema,
					responseStatus: "201",
					parameters: [documentIdParameter],
				}),
			},
			[agentSelfSignOperations.signingTask.publicPath]: {
				get: {
					...jsonOperation({
						operationId: agentSelfSignOperations.signingTask.operationId,
						summary: "Review the Bearer-authorized self-signing task",
						responseDescription: "Assigned source, fields, and selected signature",
						responseSchema: AgentSelfSignTaskResponseSchema,
					}),
					parameters: [documentIdParameter],
				},
			},
			[agentSelfSignOperations.fieldReposition.publicPath]: {
				patch: commandOperation({
					operationId: agentSelfSignOperations.fieldReposition.operationId,
					summary: "Reposition one assigned self-sign field",
					requestSchema: AgentSelfSignFieldPlacementRequestSchema,
					responseSchema: AgentSelfSignFieldPlacementResponseSchema,
					responseStatus: "200",
					parameters: [documentIdParameter, fieldIdParameter],
				}),
			},
			[agentSelfSignOperations.complete.publicPath]: {
				post: commandOperation({
					operationId: agentSelfSignOperations.complete.operationId,
					summary: "Complete typed or drawn self-signing using the server date",
					requestSchema: AgentSelfSignCompleteRequestSchema,
					responseSchema: AgentSelfSignCompleteResponseSchema,
					responseStatus: "200",
					parameters: [documentIdParameter],
				}),
			},
		},
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "SignmosToken" },
			},
		},
	};
}

function commandOperation(input: {
	operationId: string;
	summary: string;
	responseSchema: z.ZodType;
	responseStatus: "200" | "201";
	requestSchema?: z.ZodType;
	requestContent?: Record<string, { schema: unknown }>;
	parameters?: Array<Record<string, unknown>>;
}) {
	return {
		operationId: input.operationId,
		summary: input.summary,
		security: [{ bearerAuth: [] }],
		parameters: [...(input.parameters ?? []), idempotencyKeyParameter()],
		requestBody: {
			required: true,
			content:
				input.requestContent ??
				(input.requestSchema
					? { "application/json": { schema: z.toJSONSchema(input.requestSchema) } }
					: {}),
		},
		responses: {
			[input.responseStatus]: {
				description: "Command completed or exact result replayed",
				content: { "application/json": { schema: z.toJSONSchema(input.responseSchema) } },
			},
			...agentErrorResponses(),
		},
	};
}

function binaryReadOperation(
	operationId: string,
	summary: string,
	parameters: Array<Record<string, unknown>>,
) {
	return {
		operationId,
		summary,
		security: [{ bearerAuth: [] }],
		parameters,
		responses: {
			"200": {
				description: "PDF bytes",
				content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
			},
			...agentErrorResponses(),
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

function idempotencyKeyParameter() {
	return {
		name: "Idempotency-Key",
		in: "header",
		required: true,
		schema: { type: "string", minLength: 1, maxLength: 200 },
	};
}

function sourceFilenameParameter() {
	return {
		name: "X-Source-Filename",
		in: "header",
		required: false,
		schema: { type: "string", maxLength: 255 },
	};
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

## Create a self-sign draft

POST /api/v1/documents with your signer name. The verified Bearer email owns the draft; no additional verification or emailed credential is used.

## Upload one source PDF

PUT /api/v1/documents/{documentId}/source-pdf with application/pdf bytes under 10 MB. Inspect metadata or download the authorized preparation copy from the documented source routes.

## Save a signature profile

POST a typed or drawn profile with rememberSignature true. Reusable signature content is stored only with this explicit consent.

## Place signature and date fields

Use explicit coordinates or the default-fields command. One signature placeholder is permitted for the self-signer, and preparation commands are draft-only.

## Review and reposition

GET the signing task and PATCH only assigned fields where the self-sign workflow permits. Follow returned source URLs and field identifiers; never use or request a process token.

## Complete self-signing

POST a typed or drawn signature to the completion command. The server controls the signing date. Poll status until the completed detail, history, and final PDF are available.

## Use a fresh Idempotency-Key

Every POST, PUT, or PATCH command requires a fresh Idempotency-Key for one intended mutation. Exact retries return the original status and body. Reusing a key for a changed operation, JSON body, or PDF returns IDEMPOTENCY_CONFLICT without executing the changed intent.
`;
}
