import { z } from "zod";
import {
	CompleteSigningRequestSchema,
	CompleteSigningResultSchema,
	EnvelopeFieldResponseSchema,
	EnvelopeStatusSchema,
	FieldTypeSchema,
	SignatureProfileCreateRequestSchema,
	SignatureProfileResponseSchema,
	SignerSessionSchema,
} from "@/db/envelope/schema";
import { historyCatalogGroups, historyCatalogRoles } from "@/db/history-access/catalog";

export const AgentV1MeResponseSchema = z.object({
	data: z.object({
		principal: z.object({
			email: z.string().email(),
			actorType: z.literal("agent"),
		}),
		token: z.object({
			id: z.string().uuid(),
			name: z.string().min(1),
			hint: z.string().min(1),
			createdAt: z.string().datetime(),
			lastUsedAt: z.string().datetime(),
		}),
	}),
});

export const AgentV1AuthenticationErrorSchema = z.object({
	error: z.object({
		code: z.literal("AGENTIC_TOKEN_REQUIRED"),
		message: z.string(),
	}),
});

export const AgentDocumentActionSchema = z.enum([
	"resume",
	"sign",
	"review",
	"view_completed",
	"download_final_pdf",
	"cancel",
	"delete",
]);
export const AgentDocumentRoleSchema = z.enum(historyCatalogRoles);
export const AgentDocumentGroupSchema = z.enum(historyCatalogGroups);

export const AgentDocumentItemSchema = z.object({
	documentId: z.string().uuid(),
	title: z.string(),
	shortReference: z.string(),
	status: EnvelopeStatusSchema,
	group: AgentDocumentGroupSchema,
	role: AgentDocumentRoleSchema,
	participants: z.array(
		z.object({
			name: z.string(),
			email: z.string().email(),
			role: z.enum(["creator", "signer"]),
		}),
	),
	allowedActions: z.array(AgentDocumentActionSchema),
	createdAt: z.string().datetime(),
	activityAt: z.string().datetime(),
	urls: z.object({
		detail: z.string(),
		status: z.string(),
		history: z.string(),
		finalPdf: z.string().nullable(),
	}),
});

export const AgentDocumentHistoryEventSchema = z.object({
	type: z.string(),
	title: z.string(),
	detail: z.string().nullable(),
	occurredAt: z.string().datetime(),
});

export const AgentDocumentRetentionSchema = z.object({
	status: EnvelopeStatusSchema,
	eligibleAt: z.string().datetime().nullable(),
	eligible: z.boolean(),
});

export const AgentDocumentCatalogQuerySchema = z.object({
	search: z.string().trim().max(200).optional(),
	role: AgentDocumentRoleSchema.optional(),
	group: AgentDocumentGroupSchema.optional(),
	status: EnvelopeStatusSchema.exclude(["deleted"]).optional(),
	page: z.coerce.number().int().positive().default(1),
});

export const AgentDocumentCatalogResponseSchema = z.object({
	data: z.object({
		identity: z.object({ email: z.string().email() }),
		documents: z.array(AgentDocumentItemSchema),
		pagination: z.object({
			page: z.number().int().positive(),
			pageSize: z.number().int().positive(),
			totalItems: z.number().int().nonnegative(),
			totalPages: z.number().int().positive(),
		}),
	}),
});

export const AgentDocumentFinalPdfMetadataSchema = z.object({
	contentType: z.literal("application/pdf"),
	byteSize: z.number().int().nonnegative(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	createdAt: z.string().datetime().nullable(),
});

export const AgentDocumentDetailResponseSchema = z.object({
	data: z.object({
		document: AgentDocumentItemSchema,
		retention: AgentDocumentRetentionSchema,
		history: z.array(AgentDocumentHistoryEventSchema),
		finalPdf: AgentDocumentFinalPdfMetadataSchema.nullable(),
	}),
});

export const AgentDocumentStatusResponseSchema = z.object({
	data: z.object({
		documentId: z.string().uuid(),
		status: EnvelopeStatusSchema,
		group: AgentDocumentGroupSchema,
		role: AgentDocumentRoleSchema,
		allowedActions: z.array(AgentDocumentActionSchema),
		finalPdfAvailable: z.boolean(),
		retention: AgentDocumentRetentionSchema,
	}),
});

export const AgentDocumentHistoryResponseSchema = z.object({
	data: z.object({
		documentId: z.string().uuid(),
		history: z.array(AgentDocumentHistoryEventSchema),
	}),
});

const agentDocumentErrorCodes = [
	"AGENT_INVALID_DOCUMENT_QUERY",
	"AGENT_DOCUMENT_NOT_FOUND",
	"AGENT_FINAL_PDF_NOT_READY",
	"AGENT_FINAL_PDF_UNAVAILABLE",
	"IDEMPOTENCY_KEY_REQUIRED",
	"IDEMPOTENCY_CONFLICT",
	"IDEMPOTENCY_REQUEST_IN_PROGRESS",
	"AGENT_INVALID_SELF_SIGN_CREATE",
	"AGENT_SELF_SIGN_ACTION_BLOCKED",
	"INVALID_SOURCE_PDF",
	"SOURCE_PDF_TOO_LARGE",
	"DUPLICATE_SOURCE_PDF",
	"ENVELOPE_NOT_DRAFT",
	"AGENT_SOURCE_PDF_UNAVAILABLE",
	"INVALID_SIGNATURE_PROFILE",
	"SIGNATURE_REUSE_CONSENT_REQUIRED",
	"INVALID_FIELDS",
	"SIGNATURE_PLACEHOLDER_LIMIT",
	"AGENT_SIGNING_TASK_NOT_FOUND",
	"INVALID_FIELD_PLACEMENT",
	"FIELD_NOT_FOUND",
	"INVALID_SIGNING_COMPLETION",
] as const;

export const AgentDocumentErrorCodeSchema = z.enum(agentDocumentErrorCodes);
export type AgentDocumentErrorCode = z.infer<typeof AgentDocumentErrorCodeSchema>;

export const AgentDocumentErrorSchema = z.object({
	error: z.object({
		code: AgentDocumentErrorCodeSchema,
		message: z.string(),
		retryable: z.boolean(),
		allowedActions: z.array(z.string()),
		recoveryUrl: z.string().nullable(),
		validValues: z.array(z.string()).optional(),
		fields: z.array(z.string()).optional(),
		limitBytes: z.number().int().positive().optional(),
	}),
});

export const AgentSelfSignCreateRequestSchema = z.object({
	name: z.string().trim().min(1).max(120),
});

export const AgentSelfSignCreateResponseSchema = z.object({
	data: z.object({
		documentId: z.string().uuid(),
		status: z.literal("draft"),
		signingMode: z.literal("only_me"),
		sender: z.object({ name: z.string(), email: z.string().email() }),
		allowedActions: z.array(z.string()),
	}),
});

export const AgentSourcePdfResponseSchema = z.object({
	data: z.object({
		documentId: z.string().uuid(),
		version: z.number().int().positive(),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		byteSize: z.number().int().nonnegative(),
		contentType: z.literal("application/pdf"),
		originalFilename: z.string(),
		uploadedAt: z.string().datetime(),
		downloadUrl: z.string(),
	}),
});

export const AgentSignatureProfileCreateRequestSchema = z.object({
	profile: SignatureProfileCreateRequestSchema,
	rememberSignature: z.literal(true),
});

export const AgentSignatureProfileResponseSchema = z.object({
	data: SignatureProfileResponseSchema.nullable(),
});

const AgentSelfSignFieldCreateSchema = z.object({
	type: FieldTypeSchema,
	page: z.number().int().min(1),
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
});

export const AgentSelfSignFieldsRequestSchema = z.object({
	fields: z.array(AgentSelfSignFieldCreateSchema).min(1),
});

export const AgentSelfSignDefaultFieldsRequestSchema = z.object({
	page: z.number().int().min(1).default(1),
});

export const AgentSelfSignFieldsResponseSchema = z.object({
	data: z.object({
		documentId: z.string().uuid(),
		status: z.literal("sent"),
		fields: z.array(EnvelopeFieldResponseSchema),
	}),
});

export const AgentSelfSignTaskResponseSchema = z.object({ data: SignerSessionSchema });

export const AgentSelfSignFieldPlacementRequestSchema = z.object({
	page: z.number().int().min(1).optional(),
	x: z.number().int().min(0),
	y: z.number().int().min(0),
});

export const AgentSelfSignFieldPlacementResponseSchema = z.object({
	data: SignerSessionSchema.shape.fields.element,
});

export const AgentSelfSignCompleteRequestSchema = CompleteSigningRequestSchema;
export const AgentSelfSignCompleteResponseSchema = z.object({ data: CompleteSigningResultSchema });

export const agentV1IdentityOperation = {
	method: "get",
	relativePath: "/me",
	publicPath: "/api/v1/me",
	operationId: "getAgentIdentity",
	responseSchema: AgentV1MeResponseSchema,
	errorSchema: AgentV1AuthenticationErrorSchema,
} as const;

export const agentDocumentOperations = {
	catalog: {
		method: "get",
		relativePath: "/documents",
		publicPath: "/api/v1/documents",
		operationId: "listAgentDocuments",
		responseSchema: AgentDocumentCatalogResponseSchema,
	},
	detail: {
		method: "get",
		relativePath: "/documents/:documentId",
		publicPath: "/api/v1/documents/{documentId}",
		operationId: "getAgentDocument",
		responseSchema: AgentDocumentDetailResponseSchema,
	},
	status: {
		method: "get",
		relativePath: "/documents/:documentId/status",
		publicPath: "/api/v1/documents/{documentId}/status",
		operationId: "getAgentDocumentStatus",
		responseSchema: AgentDocumentStatusResponseSchema,
	},
	history: {
		method: "get",
		relativePath: "/documents/:documentId/history",
		publicPath: "/api/v1/documents/{documentId}/history",
		operationId: "getAgentDocumentHistory",
		responseSchema: AgentDocumentHistoryResponseSchema,
	},
	finalPdf: {
		method: "get",
		relativePath: "/documents/:documentId/pdf",
		publicPath: "/api/v1/documents/{documentId}/pdf",
		operationId: "downloadAgentFinalPdf",
	},
} as const;

export const agentSelfSignOperations = {
	create: operation("post", "/documents", "/api/v1/documents", "createAgentSelfSignDocument"),
	sourceUpload: operation(
		"put",
		"/documents/:documentId/source-pdf",
		"/api/v1/documents/{documentId}/source-pdf",
		"uploadAgentSourcePdf",
	),
	sourceMetadata: operation(
		"get",
		"/documents/:documentId/source-pdf",
		"/api/v1/documents/{documentId}/source-pdf",
		"getAgentSourcePdf",
	),
	sourceContent: operation(
		"get",
		"/documents/:documentId/source-pdf/content",
		"/api/v1/documents/{documentId}/source-pdf/content",
		"downloadAgentSourcePdf",
	),
	profileCreate: operation(
		"post",
		"/documents/:documentId/signature-profiles",
		"/api/v1/documents/{documentId}/signature-profiles",
		"createAgentSignatureProfile",
	),
	profileSelected: operation(
		"get",
		"/documents/:documentId/signature-profiles/selected",
		"/api/v1/documents/{documentId}/signature-profiles/selected",
		"getAgentSelectedSignatureProfile",
	),
	fieldsExplicit: operation(
		"post",
		"/documents/:documentId/fields",
		"/api/v1/documents/{documentId}/fields",
		"placeAgentFields",
	),
	fieldsDefault: operation(
		"post",
		"/documents/:documentId/fields/defaults",
		"/api/v1/documents/{documentId}/fields/defaults",
		"placeAgentDefaultFields",
	),
	signingTask: operation(
		"get",
		"/documents/:documentId/signing-task",
		"/api/v1/documents/{documentId}/signing-task",
		"getAgentSigningTask",
	),
	fieldReposition: operation(
		"patch",
		"/documents/:documentId/fields/:fieldId",
		"/api/v1/documents/{documentId}/fields/{fieldId}",
		"repositionAgentSigningField",
	),
	complete: operation(
		"post",
		"/documents/:documentId/complete",
		"/api/v1/documents/{documentId}/complete",
		"completeAgentSelfSigning",
	),
} as const;

function operation(
	method: "get" | "post" | "put" | "patch",
	relativePath: string,
	publicPath: string,
	operationId: string,
) {
	return { method, relativePath, publicPath, operationId } as const;
}
