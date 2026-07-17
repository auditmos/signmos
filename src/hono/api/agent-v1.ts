import { z } from "zod";
import {
	authenticateAgenticBearer,
	getAgentDocumentDetail,
	getAgentFinalDocumentAccess,
	listAgentDocuments,
	recordAgentDocumentRead,
} from "@/db/agentic-access";
import {
	AgentDocumentCatalogQuerySchema,
	AgentDocumentCatalogResponseSchema,
	AgentDocumentDetailResponseSchema,
	type AgentDocumentErrorCode,
	AgentDocumentErrorSchema,
	AgentDocumentHistoryResponseSchema,
	AgentDocumentStatusResponseSchema,
	AgentV1MeResponseSchema,
	agentDocumentOperations,
	agentV1IdentityOperation,
} from "@/db/agentic-access/schema";
import { createAgentHono } from "@/hono/factory";
import agentSelfSignSourceEndpoint from "./agent-v1-self-sign-source";
import agentSelfSignSigningEndpoint from "./agent-v1-self-signing";
import { getRequestIp } from "./envelope-route-helpers";

const agentV1Endpoint = createAgentHono();
const DocumentIdSchema = z.string().uuid();

agentV1Endpoint.use("*", async (c, next) => {
	const nowHeader = c.req.header("x-now");
	const principal = await authenticateAgenticBearer({
		authorization: c.req.header("authorization"),
		now: nowHeader ? new Date(nowHeader) : undefined,
		requestIp: requestIp(c),
	});
	if (!principal) {
		return c.json(
			{
				error: {
					code: "AGENTIC_TOKEN_REQUIRED",
					message: "Use Authorization: Bearer <token>",
				},
			},
			401,
		);
	}
	c.set("agenticPrincipal", principal);
	await next();
});

agentV1Endpoint.use("*", async (c, next) => {
	if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) return next();
	if (c.req.header("idempotency-key")?.trim()) return next();
	return c.json(
		agentDocumentError({
			code: "IDEMPOTENCY_KEY_REQUIRED",
			message: "An Idempotency-Key header is required for every Agent API mutation",
			retryable: false,
			allowedActions: [],
			recoveryUrl: "/agent.md",
		}),
		400,
	);
});

agentV1Endpoint.route("/", agentSelfSignSourceEndpoint);
agentV1Endpoint.route("/", agentSelfSignSigningEndpoint);

agentV1Endpoint.get(agentV1IdentityOperation.relativePath, (c) => {
	const principal = c.get("agenticPrincipal");
	return c.json(
		AgentV1MeResponseSchema.parse({
			data: {
				principal: { email: principal.email, actorType: principal.actorType },
				token: {
					id: principal.token.id,
					name: principal.token.name,
					hint: principal.token.hint,
					createdAt: principal.token.createdAt.toISOString(),
					lastUsedAt: principal.token.lastUsedAt.toISOString(),
				},
			},
		}),
	);
});

agentV1Endpoint.get(agentDocumentOperations.catalog.relativePath, async (c) => {
	const query = AgentDocumentCatalogQuerySchema.safeParse(c.req.query());
	if (!query.success) {
		return c.json(
			agentDocumentError({
				code: "AGENT_INVALID_DOCUMENT_QUERY",
				message: "Use supported role, group, status, search, and positive page filters",
				retryable: false,
				allowedActions: ["list_documents"],
				recoveryUrl: "/api/v1/documents",
			}),
			400,
		);
	}
	const principal = c.get("agenticPrincipal");
	const catalog = await listAgentDocuments(principal, query.data);
	await Promise.all(
		catalog.documents.map((document) =>
			recordAgentDocumentRead({
				principal,
				documentId: document.documentId,
				eventType: "agentic.document.listed",
				requestIp: requestIp(c),
			}),
		),
	);
	return c.json(AgentDocumentCatalogResponseSchema.parse({ data: catalog }));
});

agentV1Endpoint.get(agentDocumentOperations.status.relativePath, async (c) => {
	const documentId = parsedDocumentId(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const detail = await getAgentDocumentDetail(principal, documentId, requestNow(c));
	if (!detail) return c.json(documentNotFoundError(), 404);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.document.status_read",
		requestIp: requestIp(c),
	});
	return c.json(
		AgentDocumentStatusResponseSchema.parse({
			data: {
				documentId,
				status: detail.document.status,
				group: detail.document.group,
				role: detail.document.role,
				allowedActions: detail.document.allowedActions,
				finalPdfAvailable: Boolean(detail.finalPdf),
				retention: detail.retention,
			},
		}),
	);
});

agentV1Endpoint.get(agentDocumentOperations.history.relativePath, async (c) => {
	const documentId = parsedDocumentId(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const detail = await getAgentDocumentDetail(principal, documentId, requestNow(c));
	if (!detail) return c.json(documentNotFoundError(), 404);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.document.history_read",
		requestIp: requestIp(c),
	});
	return c.json(
		AgentDocumentHistoryResponseSchema.parse({
			data: { documentId, history: detail.history },
		}),
	);
});

agentV1Endpoint.get(agentDocumentOperations.finalPdf.relativePath, async (c) => {
	const documentId = parsedDocumentId(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const access = await getAgentFinalDocumentAccess(principal, documentId);
	if (access.state === "not_found") return c.json(documentNotFoundError(), 404);
	if (access.state === "not_ready") {
		return c.json(
			agentDocumentError({
				code: "AGENT_FINAL_PDF_NOT_READY",
				message: "The final PDF is not ready",
				retryable: true,
				allowedActions: access.item.allowedActions,
				recoveryUrl: access.item.urls.status,
			}),
			409,
		);
	}
	if (access.state === "unavailable") return c.json(pdfUnavailableError(access.item), 503);
	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	const object = await bucket?.get(access.document.r2Key);
	if (!object) return c.json(pdfUnavailableError(access.item), 503);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.final_pdf.downloaded",
		requestIp: requestIp(c),
	});
	return new Response(await object.arrayBuffer(), {
		headers: { "content-type": access.document.contentType },
	});
});

agentV1Endpoint.get(agentDocumentOperations.detail.relativePath, async (c) => {
	const documentId = parsedDocumentId(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const detail = await getAgentDocumentDetail(principal, documentId, requestNow(c));
	if (!detail) return c.json(documentNotFoundError(), 404);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.document.opened",
		requestIp: requestIp(c),
	});
	return c.json(AgentDocumentDetailResponseSchema.parse({ data: detail }));
});

function parsedDocumentId(value: string | undefined): string | null {
	const parsed = DocumentIdSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function requestNow(c: Parameters<typeof requestIp>[0]): Date {
	const nowHeader = c.req.header("x-now");
	return nowHeader ? new Date(nowHeader) : new Date();
}

function requestIp(c: {
	req: { header: (name: string) => string | undefined };
}): string | undefined {
	return getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
}

function documentNotFoundError() {
	return agentDocumentError({
		code: "AGENT_DOCUMENT_NOT_FOUND",
		message: "Document not found",
		retryable: false,
		allowedActions: ["list_documents"],
		recoveryUrl: "/api/v1/documents",
	});
}

function pdfUnavailableError(item: { allowedActions: string[]; urls: { status: string } }) {
	return agentDocumentError({
		code: "AGENT_FINAL_PDF_UNAVAILABLE",
		message: "The final PDF is temporarily unavailable",
		retryable: true,
		allowedActions: item.allowedActions,
		recoveryUrl: item.urls.status,
	});
}

function agentDocumentError(error: {
	code: AgentDocumentErrorCode;
	message: string;
	retryable: boolean;
	allowedActions: string[];
	recoveryUrl: string | null;
	validValues?: string[];
	fields?: string[];
	limitBytes?: number;
}) {
	return AgentDocumentErrorSchema.parse({ error });
}

export default agentV1Endpoint;
