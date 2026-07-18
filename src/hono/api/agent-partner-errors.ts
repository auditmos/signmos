import type { AgentPartnerSigningAuthorization } from "@/db/agentic-access";
import { agentError } from "./agent-v1-command-helpers";

export function agentPartnerAuthorizationError(
	authorization: Exclude<AgentPartnerSigningAuthorization, { state: "active" }>,
	documentId: string,
): { status: number; body: ReturnType<typeof agentError> } {
	const recoveryUrl = `/api/v1/documents/${documentId}/status`;
	if (authorization.state === "not_found") {
		return {
			status: 404,
			body: agentError({
				code: "AGENT_SIGNING_TASK_NOT_FOUND",
				message: "Signing task not found",
				retryable: false,
				allowedActions: ["list_documents"],
				recoveryUrl: "/api/v1/documents",
			}),
		};
	}
	if (authorization.state === "wrong_identity") {
		return {
			status: 403,
			body: agentError({
				code: "AGENT_SIGNING_WRONG_IDENTITY",
				message: "This verified email is not the invited partner",
				retryable: false,
				allowedActions: ["list_documents"],
				recoveryUrl: "/api/v1/documents",
			}),
		};
	}
	const codeByState = {
		inactive: "AGENT_SIGNING_INACTIVE",
		completed: "AGENT_SIGNING_COMPLETED",
		changes_requested: "AGENT_SIGNING_CHANGES_REQUESTED",
		declined: "AGENT_SIGNING_DECLINED",
		expired: "AGENT_SIGNING_EXPIRED",
		deleted: "AGENT_SIGNING_DELETED",
	} as const;
	const messageByState = {
		inactive: "Signing is not active for this document",
		completed: "This signing task is already completed",
		changes_requested: "The document is waiting for creator revision",
		declined: "This signing task was declined",
		expired: "This signing task expired",
		deleted: "This signing task was deleted",
	} as const;
	return {
		status:
			authorization.state === "declined" ||
			authorization.state === "expired" ||
			authorization.state === "deleted"
				? 410
				: 409,
		body: agentError({
			code: codeByState[authorization.state],
			message: messageByState[authorization.state],
			retryable: false,
			allowedActions:
				authorization.state === "completed"
					? ["get_document", "download_final_pdf"]
					: authorization.state === "deleted"
						? ["list_documents"]
						: ["get_document_status"],
			recoveryUrl: authorization.state === "deleted" ? "/api/v1/documents" : recoveryUrl,
		}),
	};
}
