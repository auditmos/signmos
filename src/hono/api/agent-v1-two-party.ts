import {
	AgentRecipientMutationError,
	addAgentCreatorRecipients,
	authorizeAgentPartnerSigning,
	claimAgentCommand,
	completeAgentCommand,
	deleteAgentCreatorRecipient,
	fingerprintAgentCommand,
	listAgentCreatorFields,
	listAgentCreatorRecipients,
	listAgentPartnerFields,
	recordAgentDocumentRead,
	updateAgentCreatorRecipient,
} from "@/db/agentic-access";
import {
	AgentEmptyCommandRequestSchema,
	AgentFieldsResponseSchema,
	AgentRecipientCreateSchema,
	AgentRecipientResponseSchema,
	AgentRecipientsAddRequestSchema,
	AgentRecipientsResponseSchema,
	agentTwoPartyOperations,
} from "@/db/agentic-access/schema";
import { toEnvelopeFieldResponse, toRecipientResponse } from "@/db/envelope";
import { createAgentHono } from "@/hono/factory";
import { agentPartnerAuthorizationError } from "./agent-partner-errors";
import {
	agentError,
	commandClaimResponse,
	documentNotFoundError,
	parsedUuid,
	requestIp,
	requiredIdempotencyKey,
} from "./agent-v1-command-helpers";

const agentTwoPartyEndpoint = createAgentHono();

agentTwoPartyEndpoint.get(agentTwoPartyOperations.fieldsList.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const creatorFields = await listAgentCreatorFields(principal, documentId);
	const partnerAuthorization = creatorFields
		? null
		: await authorizeAgentPartnerSigning(principal, documentId);
	if (!creatorFields && partnerAuthorization?.state !== "active") {
		const error = agentPartnerAuthorizationError(
			partnerAuthorization ?? { state: "not_found" },
			documentId,
		);
		return Response.json(error.body, { status: error.status });
	}
	const fields =
		creatorFields ??
		(partnerAuthorization?.state === "active"
			? await listAgentPartnerFields(partnerAuthorization.token)
			: []);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.fields.read",
		requestIp: requestIp(c),
	});
	return c.json(AgentFieldsResponseSchema.parse({ data: fields.map(toEnvelopeFieldResponse) }));
});

agentTwoPartyEndpoint.get(agentTwoPartyOperations.recipientsList.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const recipients = await listAgentCreatorRecipients(principal, documentId);
	if (!recipients) return c.json(documentNotFoundError(), 404);
	await recordAgentDocumentRead({
		principal,
		documentId,
		eventType: "agentic.recipients.read",
		requestIp: requestIp(c),
	});
	return c.json(AgentRecipientsResponseSchema.parse({ data: recipients.map(toRecipientResponse) }));
});

agentTwoPartyEndpoint.post(agentTwoPartyOperations.recipientsAdd.relativePath, async (c) => {
	const parsed = AgentRecipientsAddRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json(invalidRecipientsError(), 400);
	const documentId = parsedUuid(c.req.param("documentId"));
	if (!documentId) return c.json(documentNotFoundError(), 404);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentTwoPartyOperations.recipientsAdd.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	try {
		const recipients = await addAgentCreatorRecipients({
			principal,
			documentId,
			recipients: parsed.data.recipients,
		});
		const body = AgentRecipientsResponseSchema.parse({
			data: recipients.map(toRecipientResponse),
		});
		await recordRecipientMutation(principal, documentId, "agentic.recipients.added", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 201, body, documentId });
		return c.json(body, 201);
	} catch (error) {
		return completeRecipientError(claim.recordId, documentId, error);
	}
});

agentTwoPartyEndpoint.patch(agentTwoPartyOperations.recipientUpdate.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const recipientId = parsedUuid(c.req.param("recipientId"));
	const parsed = AgentRecipientCreateSchema.safeParse(await c.req.json().catch(() => null));
	if (!documentId || !recipientId || !parsed.success) return c.json(invalidRecipientsError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentTwoPartyOperations.recipientUpdate.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, recipientId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	try {
		const recipient = await updateAgentCreatorRecipient({
			principal,
			documentId,
			recipientId,
			recipient: parsed.data,
		});
		const body = AgentRecipientResponseSchema.parse({ data: toRecipientResponse(recipient) });
		await recordRecipientMutation(principal, documentId, "agentic.recipient.updated", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 200, body, documentId });
		return c.json(body);
	} catch (error) {
		return completeRecipientError(claim.recordId, documentId, error);
	}
});

agentTwoPartyEndpoint.delete(agentTwoPartyOperations.recipientDelete.relativePath, async (c) => {
	const documentId = parsedUuid(c.req.param("documentId"));
	const recipientId = parsedUuid(c.req.param("recipientId"));
	const parsed = AgentEmptyCommandRequestSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!documentId || !recipientId) return c.json(documentNotFoundError(), 404);
	if (!parsed.success) return c.json(invalidRecipientsError(), 400);
	const principal = c.get("agenticPrincipal");
	const claim = await claimAgentCommand({
		principal,
		idempotencyKey: requiredIdempotencyKey(c),
		operation: agentTwoPartyOperations.recipientDelete.operationId,
		requestFingerprint: await fingerprintAgentCommand({ documentId, recipientId, ...parsed.data }),
	});
	if (claim.state !== "execute") return commandClaimResponse(claim);
	try {
		const recipient = await deleteAgentCreatorRecipient({ principal, documentId, recipientId });
		const body = AgentRecipientResponseSchema.parse({ data: toRecipientResponse(recipient) });
		await recordRecipientMutation(principal, documentId, "agentic.recipient.deleted", c);
		await completeAgentCommand({ recordId: claim.recordId, status: 200, body, documentId });
		return c.json(body);
	} catch (error) {
		return completeRecipientError(claim.recordId, documentId, error);
	}
});

async function recordRecipientMutation(
	principal: Parameters<typeof recordAgentDocumentRead>[0]["principal"],
	documentId: string,
	eventType: Parameters<typeof recordAgentDocumentRead>[0]["eventType"],
	c: { req: { header: (name: string) => string | undefined } },
): Promise<void> {
	await recordAgentDocumentRead({ principal, documentId, eventType, requestIp: requestIp(c) });
}

async function completeRecipientError(
	recordId: string,
	documentId: string,
	error: unknown,
): Promise<Response> {
	if (!(error instanceof AgentRecipientMutationError)) throw error;
	const { status, body } = recipientError(documentId, error.code);
	await completeAgentCommand({ recordId, status, body, documentId });
	return Response.json(body, { status });
}

function recipientError(documentId: string, code: AgentRecipientMutationError["code"]) {
	if (code === "DOCUMENT_NOT_FOUND" || code === "NOT_TWO_PARTY") {
		return { status: 404, body: documentNotFoundError() };
	}
	if (code === "RECIPIENT_NOT_FOUND") {
		return {
			status: 404,
			body: agentError({
				code,
				message: "Recipient not found",
				retryable: false,
				allowedActions: ["list_recipients"],
				recoveryUrl: `/api/v1/documents/${documentId}/recipients`,
			}),
		};
	}
	const publicCode = code === "NOT_DRAFT" ? "ENVELOPE_NOT_DRAFT" : code;
	return {
		status: 409,
		body: agentError({
			code: publicCode,
			message: recipientErrorMessage(code),
			retryable: false,
			allowedActions: ["list_recipients"],
			recoveryUrl: `/api/v1/documents/${documentId}/recipients`,
			limit: code === "RECIPIENT_LIMIT_REACHED" ? 10 : undefined,
		}),
	};
}

function recipientErrorMessage(code: AgentRecipientMutationError["code"]): string {
	if (code === "DUPLICATE_RECIPIENT") return "Recipient email already exists on this document";
	if (code === "RECIPIENT_LIMIT_REACHED") return "A document supports at most 10 recipients";
	if (code === "CREATOR_RECIPIENT_LOCKED") return "The creator recipient cannot be changed";
	return "Recipients can only be changed while the document is draft";
}

function invalidRecipientsError() {
	return agentError({
		code: "INVALID_RECIPIENTS",
		message: "Use 1 to 10 recipients with valid names and emails",
		retryable: false,
		allowedActions: ["add_recipients"],
		recoveryUrl: "/agent.md",
		fields: ["recipients"],
		limit: 10,
	});
}

export default agentTwoPartyEndpoint;
