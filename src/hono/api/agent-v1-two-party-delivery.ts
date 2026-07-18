import {
	AgentTwoPartyDeliveryError,
	claimAgentCommand,
	completeAgentCommand,
	fingerprintAgentCommand,
	recordAgentDocumentRead,
	resendAgentTwoPartyInvitation,
	sendAgentTwoPartyDocument,
} from "@/db/agentic-access";
import type { AgenticPrincipal } from "@/db/agentic-access/bearer-principal";
import {
	type AgentDocumentErrorCode,
	AgentEmptyCommandRequestSchema,
	AgentTwoPartyResendResponseSchema,
	AgentTwoPartySendResponseSchema,
	agentTwoPartyOperations,
} from "@/db/agentic-access/schema";
import { type EmailDeliveryEnv, EmailDeliveryError } from "@/db/envelope";
import { createAgentHono } from "@/hono/factory";
import {
	agentError,
	commandClaimResponse,
	documentNotFoundError,
	parsedUuid,
	requestIp,
	requiredIdempotencyKey,
} from "./agent-v1-command-helpers";

const agentTwoPartyDeliveryEndpoint = createAgentHono();

agentTwoPartyDeliveryEndpoint.post(agentTwoPartyOperations.send.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const parsed = AgentEmptyCommandRequestSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	if (!parsed.success) return c.json(invalidEmptyCommandError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentTwoPartyOperations.send.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	try {
		const result = await sendAgentTwoPartyDocument({
			principal,
			documentId,
			emailDelivery: deliveryOptions(c),
		});
		const body = AgentTwoPartySendResponseSchema.parse({ data: result });
		await recordDeliveryEvent(principal, documentId, "agentic.document.sent", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 200, body, documentId });
		return c.json(body);
	} catch (error) {
		return completeDeliveryError(claim.recordId, documentId, error);
	}
});

agentTwoPartyDeliveryEndpoint.post(agentTwoPartyOperations.resend.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const recipientId = parsedUuid(c.req.param("recipientId"));
	const parsed = AgentEmptyCommandRequestSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!documentId || !recipientId) return c.json(documentNotFoundError(), 404);
	if (!parsed.success) return c.json(invalidEmptyCommandError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentTwoPartyOperations.resend.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, recipientId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	try {
		const result = await resendAgentTwoPartyInvitation({
			principal,
			documentId,
			recipientId,
			emailDelivery: deliveryOptions(c),
		});
		const body = AgentTwoPartyResendResponseSchema.parse({ data: result });
		await recordDeliveryEvent(principal, documentId, "agentic.invitation.resent", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 201, body, documentId });
		return c.json(body, 201);
	} catch (error) {
		return completeDeliveryError(claim.recordId, documentId, error);
	}
});

function deliveryOptions(c: { env?: unknown; req: { url: string } }) {
	return {
		env: c.env as EmailDeliveryEnv | undefined,
		baseUrl:
			(c.env as EmailDeliveryEnv | undefined)?.APP_BASE_URL?.trim() || new URL(c.req.url).origin,
	};
}

async function recordDeliveryEvent(
	principal: AgenticPrincipal,
	documentId: string,
	eventType: Parameters<typeof recordAgentDocumentRead>[0]["eventType"],
	c: { req: { header: (name: string) => string | undefined } },
): Promise<void> {
	await recordAgentDocumentRead({ principal, documentId, eventType, requestIp: requestIp(c) });
}

async function completeDeliveryError(
	recordId: string,
	documentId: string,
	error: unknown,
): Promise<Response> {
	const response = deliveryError(documentId, error);
	if (!response) throw error;
	await completeAgentCommand({
		recordId,
		status: response.status,
		body: response.body,
		documentId,
	});
	return Response.json(response.body, { status: response.status });
}

function deliveryError(documentId: string, error: unknown) {
	if (error instanceof EmailDeliveryError) {
		return {
			status: 502,
			body: agentError({
				code: "EMAIL_DELIVERY_FAILED",
				message: "The delivery provider rejected the invitation",
				retryable: true,
				allowedActions: ["retry_send"],
				recoveryUrl: `/api/v1/documents/${documentId}/status`,
			}),
		};
	}
	if (!(error instanceof AgentTwoPartyDeliveryError)) return null;
	if (error.code === "DOCUMENT_NOT_FOUND") {
		return { status: 404, body: documentNotFoundError() };
	}
	const code = publicDeliveryCode(error.code);
	return {
		status: error.code === "RECIPIENT_NOT_FOUND" ? 404 : 409,
		body: agentError({
			code,
			message: deliveryErrorMessage(error.code),
			retryable: false,
			allowedActions: deliveryAllowedActions(error.code),
			recoveryUrl: `/api/v1/documents/${documentId}/status`,
		}),
	};
}

function publicDeliveryCode(code: AgentTwoPartyDeliveryError["code"]): AgentDocumentErrorCode {
	const codes: Record<AgentTwoPartyDeliveryError["code"], AgentDocumentErrorCode> = {
		DOCUMENT_NOT_FOUND: "AGENT_DOCUMENT_NOT_FOUND",
		NOT_DRAFT: "ENVELOPE_NOT_DRAFT",
		SOURCE_REQUIRED: "SOURCE_PDF_REQUIRED",
		PARTNER_REQUIRED: "PARTNER_RECIPIENT_REQUIRED",
		RECIPIENT_FIELDS_REQUIRED: "RECIPIENT_FIELDS_REQUIRED",
		CREATOR_SIGNING_REQUIRED: "CREATOR_SIGNING_REQUIRED",
		RESEND_NOT_ALLOWED: "RESEND_NOT_ALLOWED",
		RECIPIENT_NOT_FOUND: "RECIPIENT_NOT_FOUND",
	};
	return codes[code];
}

function deliveryErrorMessage(code: AgentTwoPartyDeliveryError["code"]): string {
	const messages: Record<AgentTwoPartyDeliveryError["code"], string> = {
		DOCUMENT_NOT_FOUND: "Document not found",
		NOT_DRAFT: "Only a draft document can be sent",
		SOURCE_REQUIRED: "Upload a source PDF before sending",
		PARTNER_REQUIRED: "Add at least one partner recipient before sending",
		RECIPIENT_FIELDS_REQUIRED: "Place fields for every recipient before sending",
		CREATOR_SIGNING_REQUIRED: "Complete the creator signing step before sending",
		RESEND_NOT_ALLOWED: "This invitation cannot be resent in the current state",
		RECIPIENT_NOT_FOUND: "Partner recipient not found",
	};
	return messages[code];
}

function deliveryAllowedActions(code: AgentTwoPartyDeliveryError["code"]): string[] {
	const actions: Partial<Record<AgentTwoPartyDeliveryError["code"], string[]>> = {
		SOURCE_REQUIRED: ["upload_source_pdf"],
		PARTNER_REQUIRED: ["add_recipients"],
		RECIPIENT_FIELDS_REQUIRED: ["place_fields"],
		CREATOR_SIGNING_REQUIRED: ["complete_creator_signing"],
		RESEND_NOT_ALLOWED: ["get_document_status"],
	};
	return actions[code] ?? ["get_document_status"];
}

function invalidEmptyCommandError() {
	return agentError({
		code: "AGENT_SELF_SIGN_ACTION_BLOCKED",
		message: "This command does not accept request fields",
		retryable: false,
		allowedActions: [],
		recoveryUrl: "/agent.md",
		fields: ["body"],
	});
}

export default agentTwoPartyDeliveryEndpoint;
