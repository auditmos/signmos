import {
	authorizeAgentPartnerSigning,
	claimAgentCommand,
	claimHumanReviewCommand,
	completeAgentCommand,
	fingerprintAgentCommand,
	inspectHumanReviewCommand,
	listAgentPartnerFields,
	recordAgentDocumentRead,
} from "@/db/agentic-access";
import {
	AgentPartnerChangeRequestSchema,
	AgentPartnerChangeResponseSchema,
	AgentPartnerDeclineRequestSchema,
	agentPartnerOperations,
} from "@/db/agentic-access/partner-signing-schema";
import {
	type EmailDeliveryEnv,
	EmailDeliveryError,
	getLatestSourcePdfDocument,
	requestSigningChanges,
	SigningChangeRequestError,
} from "@/db/envelope";
import { createAgentHono } from "@/hono/factory";
import { agentPartnerAuthorizationError } from "./agent-partner-errors";
import {
	agentError,
	commandClaimResponse,
	parsedUuid,
	requestIp,
	requestNow,
	requiredIdempotencyKey,
} from "./agent-v1-command-helpers";
import { deliverHumanReviewNotification } from "./agent-v1-human-review-notification";

const agentPartnerDecisionEndpoint = createAgentHono();

agentPartnerDecisionEndpoint.post(agentPartnerOperations.changeRequest.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const parsed = AgentPartnerChangeRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!documentId || !parsed.success) return c.json(invalidChangeRequestError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentPartnerOperations.changeRequest.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	const authorization = await authorizeAgentPartnerSigning(principal, documentId);
	if (authorization.state !== "active") {
		return completeAuthorizationError(claim.recordId, documentId, authorization);
	}
	try {
		const result = await requestSigningChanges(authorization.token, parsed.data, {
			emailDelivery: emailDelivery(c),
		});
		const body = AgentPartnerChangeResponseSchema.parse({ data: result });
		await recordPartnerAction(principal, documentId, "agentic.partner.change_requested", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 200, body, documentId });
		return c.json(body);
	} catch (error) {
		if (error instanceof EmailDeliveryError) {
			return completeEmailError(claim.recordId, documentId);
		}
		if (error instanceof SigningChangeRequestError) {
			const refreshed = await authorizeAgentPartnerSigning(principal, documentId);
			if (refreshed.state !== "active") {
				return completeAuthorizationError(claim.recordId, documentId, refreshed);
			}
		}
		throw error;
	}
});

agentPartnerDecisionEndpoint.post(agentPartnerOperations.decline.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const parsed = AgentPartnerDeclineRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!documentId || !parsed.success) return c.json(invalidDeclineError(), 400);
	const principal = c.get("agenticPrincipal");
	const requestFingerprint = await fingerprintAgentCommand({ documentId, ...parsed.data });
	const priorReview = await inspectHumanReviewCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentPartnerOperations.decline.operationId,
		requestFingerprint,
	});
	if (priorReview) return commandClaimResponse(priorReview);
	const authorization = await authorizeAgentPartnerSigning(principal, documentId);
	if (authorization.state !== "active") {
		const error = agentPartnerAuthorizationError(authorization, documentId);
		return Response.json(error.body, { status: error.status });
	}
	const source = await getLatestSourcePdfDocument(documentId);
	if (!source) {
		return c.json(agentPartnerAuthorizationError({ state: "not_found" }, documentId).body, 404);
	}
	const reviewerFields = (await listAgentPartnerFields(authorization.token)).map(
		({ id, type, page, x, y, width, height }) => ({ id, type, page, x, y, width, height }),
	);
	const reviewClaim = await claimHumanReviewCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentPartnerOperations.decline.operationId,
		requestFingerprint,
		documentId,
		reviewer: {
			email: principal.email,
			role: "signer",
			recipientId: authorization.token.recipientId,
			fields: reviewerFields,
		},
		source: {
			id: source.id,
			version: source.version,
			sha256: source.sha256,
			originalFilename: source.originalFilename,
		},
		actionPayload: parsed.data,
		actionPayloadDigest: await fingerprintAgentCommand(parsed.data),
		baseUrl: emailDelivery(c).baseUrl,
		now: requestNow(c),
	});
	if (reviewClaim.state !== "created") return commandClaimResponse(reviewClaim);
	const response = await deliverHumanReviewNotification({
		principal,
		documentId,
		intentAuditEvent: "agentic.human_review.decline_requested",
		commandId: reviewClaim.commandId,
		response: reviewClaim.response,
		reviewerEmail: principal.email,
		documentName: source.originalFilename,
		actionLabel: "Decline signing",
		agentName: principal.token.name,
		consequence: "This will decline the document and stop signing.",
		emailDelivery: emailDelivery(c),
	});
	return c.json(response, 202);
});

async function completeAuthorizationError(
	recordId: string,
	documentId: string,
	authorization: Exclude<
		Awaited<ReturnType<typeof authorizeAgentPartnerSigning>>,
		{ state: "active" }
	>,
): Promise<Response> {
	const error = agentPartnerAuthorizationError(authorization, documentId);
	await completeAgentCommand({ recordId, status: error.status, body: error.body, documentId });
	return Response.json(error.body, { status: error.status });
}

async function completeEmailError(recordId: string, documentId: string): Promise<Response> {
	const body = agentError({
		code: "EMAIL_DELIVERY_FAILED",
		message: "Email provider rejected the message",
		retryable: true,
		allowedActions: ["retry_change_request"],
		recoveryUrl: `/api/v1/documents/${documentId}/status`,
	});
	await completeAgentCommand({ recordId, status: 502, body, documentId });
	return Response.json(body, { status: 502 });
}

async function recordPartnerAction(
	principal: Parameters<typeof recordAgentDocumentRead>[0]["principal"],
	documentId: string,
	eventType: Parameters<typeof recordAgentDocumentRead>[0]["eventType"],
	c: { req: { header: (name: string) => string | undefined } },
): Promise<void> {
	await recordAgentDocumentRead({ principal, documentId, eventType, requestIp: requestIp(c) });
}

function emailDelivery(c: { env?: Env; req: { url: string } }) {
	return {
		env: c.env as EmailDeliveryEnv | undefined,
		baseUrl:
			(c.env as EmailDeliveryEnv | undefined)?.APP_BASE_URL?.trim() || new URL(c.req.url).origin,
	};
}

function invalidChangeRequestError() {
	return agentError({
		code: "INVALID_CHANGE_REQUEST",
		message: "A non-empty change request comment is required",
		retryable: false,
		allowedActions: ["get_signing_task"],
		recoveryUrl: "/agent.md",
		fields: ["comment"],
	});
}

function invalidDeclineError() {
	return agentError({
		code: "INVALID_SIGNING_DECLINE",
		message: "A non-empty decline reason is required",
		retryable: false,
		allowedActions: ["get_signing_task"],
		recoveryUrl: "/agent.md",
		fields: ["reason"],
	});
}

export default agentPartnerDecisionEndpoint;
