import {
	claimHumanReviewCommand,
	fingerprintAgentCommand,
	getAuthorizedAgentCreatorEnvelope,
	inspectHumanReviewCommand,
	recordAgentDocumentRead,
} from "@/db/agentic-access";
import {
	AgentCreatorControlRequestSchema,
	AgentCreatorRetentionResponseSchema,
	agentCreatorControlOperations,
} from "@/db/agentic-access/creator-controls-schema";
import {
	type EmailDeliveryEnv,
	getEnvelopeAllowedActions,
	getEnvelopeRetentionStatus,
	getLatestSourcePdfDocument,
} from "@/db/envelope";
import { createAgentHono } from "@/hono/factory";
import {
	agentError,
	commandClaimResponse,
	documentNotFoundError,
	parsedUuid,
	requestIp,
	requestNow,
	requiredIdempotencyKey,
} from "./agent-v1-command-helpers";
import { deliverHumanReviewNotification } from "./agent-v1-human-review-notification";

const agentCreatorControlsEndpoint = createAgentHono();

agentCreatorControlsEndpoint.post(agentCreatorControlOperations.action.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const parsed = AgentCreatorControlRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!documentId || !parsed.success) return c.json(invalidCreatorControlError(), 400);
	const principal = c.get("agenticPrincipal");
	const idempotencyKey = requiredIdempotencyKey(c);
	const requestFingerprint = await fingerprintAgentCommand({ documentId, ...parsed.data });
	const priorReview = await inspectHumanReviewCommand({
		principal,
		idempotencyKey,
		operation: agentCreatorControlOperations.action.operationId,
		requestFingerprint,
	});
	if (priorReview) return commandClaimResponse(priorReview);
	const envelope = await getAuthorizedAgentCreatorEnvelope(principal, documentId);
	if (!envelope) return c.json(documentNotFoundError(), 404);
	if (
		parsed.data.action !== "delete" &&
		envelope.status !== "sent" &&
		envelope.status !== "changes_requested"
	) {
		return c.json(controlBlockedError(documentId, envelope.status), 409);
	}
	if (parsed.data.action === "delete") {
		const retention = await getEnvelopeRetentionStatus(documentId, requestNow(c));
		if (!retention.retentionEligible) return c.json(deleteRetentionBlockedError(documentId), 409);
	}
	const source = await getLatestSourcePdfDocument(documentId);
	if (!source) return c.json(documentNotFoundError(), 404);
	const reviewClaim = await claimHumanReviewCommand({
		principal,
		idempotencyKey,
		operation: agentCreatorControlOperations.action.operationId,
		requestFingerprint,
		documentId,
		reviewer: { email: principal.email, role: "creator", fields: [] },
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
		intentAuditEvent: creatorControlIntentAuditEvent(parsed.data.action),
		commandId: reviewClaim.commandId,
		response: reviewClaim.response,
		reviewerEmail: principal.email,
		documentName: source.originalFilename,
		actionLabel: controlReviewLabel(parsed.data.action),
		agentName: principal.token.name,
		consequence: controlReviewConsequence(parsed.data.action),
		emailDelivery: emailDelivery(c),
	});
	return c.json(response, 202);
});

agentCreatorControlsEndpoint.get(
	agentCreatorControlOperations.retention.relativePath,
	async (c) => {
		const documentId = parsedUuid(c.req.param("documentId"));
		if (!documentId) return c.json(documentNotFoundError(), 404);
		const principal = c.get("agenticPrincipal");
		if (!(await getAuthorizedAgentCreatorEnvelope(principal, documentId))) {
			return c.json(documentNotFoundError(), 404);
		}
		const retention = await getEnvelopeRetentionStatus(documentId, requestNow(c));
		await recordAgentDocumentRead({
			principal,
			documentId,
			eventType: "agentic.retention.read",
			requestIp: requestIp(c),
		});
		return c.json(AgentCreatorRetentionResponseSchema.parse({ data: retention }));
	},
);

function controlBlockedError(
	documentId: string,
	status: Parameters<typeof getEnvelopeAllowedActions>[0],
) {
	return agentError({
		code: "ENVELOPE_ACTION_BLOCKED",
		message: "Envelope action is not allowed in the current state",
		retryable: false,
		allowedActions: getEnvelopeAllowedActions(status),
		recoveryUrl: `/api/v1/documents/${documentId}/status`,
	});
}

function deleteRetentionBlockedError(documentId: string) {
	return agentError({
		code: "ENVELOPE_ACTION_BLOCKED",
		message: "The document is not yet eligible for deletion",
		retryable: false,
		allowedActions: ["get_retention"],
		recoveryUrl: `/api/v1/documents/${documentId}/retention`,
	});
}

function controlReviewLabel(action: "cancel" | "expire" | "delete") {
	if (action === "cancel") return "Cancel document";
	if (action === "expire") return "Expire document";
	return "Delete document";
}

function creatorControlIntentAuditEvent(action: "cancel" | "expire" | "delete") {
	if (action === "cancel") return "agentic.human_review.cancel_requested" as const;
	if (action === "expire") return "agentic.human_review.expire_requested" as const;
	return "agentic.human_review.delete_requested" as const;
}

function controlReviewConsequence(action: "cancel" | "expire" | "delete") {
	if (action === "cancel")
		return "This will stop outstanding signing and mark the document expired.";
	if (action === "expire") return "This will expire the document and stop outstanding signing.";
	return "This will permanently delete the document and its stored PDF files.";
}

function emailDelivery(c: { env?: Env; req: { url: string } }) {
	return {
		env: c.env as EmailDeliveryEnv | undefined,
		baseUrl:
			(c.env as EmailDeliveryEnv | undefined)?.APP_BASE_URL?.trim() || new URL(c.req.url).origin,
	};
}

function invalidCreatorControlError() {
	return agentError({
		code: "INVALID_CREATOR_CONTROL",
		message: "Use cancel, expire, or delete",
		retryable: false,
		allowedActions: ["get_document_status"],
		recoveryUrl: "/agent.md",
		validValues: ["cancel", "expire", "delete"],
		fields: ["action"],
	});
}

export default agentCreatorControlsEndpoint;
