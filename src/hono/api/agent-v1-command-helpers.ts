import { z } from "zod";
import { type AgentDocumentErrorCode, AgentDocumentErrorSchema } from "@/db/agentic-access/schema";
import { getRequestIp } from "./envelope-route-helpers";

const UuidSchema = z.string().uuid();

export function parsedUuid(value: string | undefined): string | null {
	const parsed = UuidSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function requestNow(c: { req: { header: (name: string) => string | undefined } }): Date {
	return new Date(c.req.header("x-now") ?? Date.now());
}

export function requestIp(c: {
	req: { header: (name: string) => string | undefined };
}): string | undefined {
	return getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
}

export function requiredIdempotencyKey(c: {
	req: { header: (name: string) => string | undefined };
}): string {
	const value = c.req.header("idempotency-key")?.trim();
	if (!value) throw new Error("Idempotency middleware invariant failed");
	return value;
}

export function commandClaimResponse(claim: {
	state: "execute" | "replay" | "conflict" | "in_progress";
	status?: number;
	body?: unknown;
}): Response {
	if (claim.state === "execute") throw new Error("Command claim must execute");
	if (claim.state === "replay" && typeof claim.status === "number") {
		return Response.json(claim.body, { status: claim.status });
	}
	return Response.json(
		agentError({
			code: claim.state === "conflict" ? "IDEMPOTENCY_CONFLICT" : "IDEMPOTENCY_REQUEST_IN_PROGRESS",
			message:
				claim.state === "conflict"
					? "This Idempotency-Key was already used for a different request"
					: "The original command is still in progress",
			retryable: claim.state === "in_progress",
			allowedActions: [],
			recoveryUrl: "/agent.md",
		}),
		{ status: 409 },
	);
}

export function documentNotFoundError() {
	return agentError({
		code: "AGENT_DOCUMENT_NOT_FOUND",
		message: "Document not found",
		retryable: false,
		allowedActions: ["list_documents"],
		recoveryUrl: "/api/v1/documents",
	});
}

export function agentError(error: {
	code: AgentDocumentErrorCode;
	message: string;
	retryable: boolean;
	allowedActions: string[];
	recoveryUrl: string | null;
	validValues?: string[];
	fields?: string[];
	limitBytes?: number;
	limit?: number;
}) {
	return AgentDocumentErrorSchema.parse({ error });
}
