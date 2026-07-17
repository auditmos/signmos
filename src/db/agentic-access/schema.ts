import { z } from "zod";
import { EnvelopeStatusSchema } from "@/db/envelope/schema";
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
] as const;

export const AgentDocumentErrorSchema = z.object({
	error: z.object({
		code: z.enum(agentDocumentErrorCodes),
		message: z.string(),
		retryable: z.boolean(),
		allowedActions: z.array(z.string()),
		recoveryUrl: z.string().nullable(),
	}),
});

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
