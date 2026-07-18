import {
	claimAgentCommand,
	completeAgentCommand,
	fingerprintAgentCommand,
	getAuthorizedAgentCreatorEnvelope,
	recordAgentDocumentRead,
} from "@/db/agentic-access";
import {
	AgentCreatorControlRequestSchema,
	AgentCreatorControlResponseSchema,
	AgentCreatorRetentionResponseSchema,
	agentCreatorControlOperations,
} from "@/db/agentic-access/creator-controls-schema";
import { controlEnvelope, EnvelopeControlError, getEnvelopeRetentionStatus } from "@/db/envelope";
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

const agentCreatorControlsEndpoint = createAgentHono();

agentCreatorControlsEndpoint.post(agentCreatorControlOperations.action.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const parsed = AgentCreatorControlRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!documentId || !parsed.success) return c.json(invalidCreatorControlError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentCreatorControlOperations.action.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	if (!(await getAuthorizedAgentCreatorEnvelope(principal, documentId))) {
		return completeControlResponse(claim.recordId, documentId, 404, documentNotFoundError());
	}
	try {
		const result = await controlEnvelope(documentId, principal.email, parsed.data.action, {
			documentsBucket: (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)
				?.DOCUMENTS_BUCKET,
		});
		const body = AgentCreatorControlResponseSchema.parse({ data: result });
		await recordAgentDocumentRead({
			principal,
			documentId,
			eventType: controlAuditEvent(parsed.data.action),
			requestIp: requestIp(c),
		});
		await completeAgentCommand({
			recordId: claim.recordId,
			status: 200,
			body,
			documentId,
			now: requestNow(c),
		});
		return c.json(body);
	} catch (error) {
		if (!(error instanceof EnvelopeControlError)) throw error;
		return completeControlResponse(
			claim.recordId,
			documentId,
			409,
			agentError({
				code: "ENVELOPE_ACTION_BLOCKED",
				message: error.message,
				retryable: false,
				allowedActions: error.allowedActions,
				recoveryUrl: `/api/v1/documents/${documentId}/status`,
			}),
		);
	}
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

async function completeControlResponse(
	recordId: string,
	documentId: string,
	status: number,
	body: unknown,
): Promise<Response> {
	await completeAgentCommand({ recordId, status, body, documentId });
	return Response.json(body, { status });
}

function controlAuditEvent(action: "cancel" | "expire" | "delete") {
	if (action === "cancel") return "agentic.document.canceled" as const;
	if (action === "expire") return "agentic.document.expired" as const;
	return "agentic.document.deleted" as const;
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
