import { z } from "zod";
import {
	AgentPartnerChangeRequestSchema,
	AgentPartnerChangeResponseSchema,
	AgentPartnerDeclineRequestSchema,
	AgentPartnerDeclineResponseSchema,
} from "@/db/agentic-access/partner-signing-schema";
import { publicAgentContractHono } from "@/hono/public-agent-contract";

describe("agent API contract partner decisions", () => {
	it("publishes partner discovery, assigned-content, decisions, polling, and recovery", async () => {
		const response = await publicAgentContractHono.request("/openapi.json");
		const document = (await response.json()) as {
			paths: Record<string, Record<string, unknown>>;
		};
		for (const [method, path, operationId, mutates] of [
			["get", "/api/v1/documents/{documentId}/signing-task", "getAgentSigningTask", false],
			["get", "/api/v1/documents/{documentId}/source-pdf", "getAgentSourcePdf", false],
			["get", "/api/v1/documents/{documentId}/source-pdf/content", "downloadAgentSourcePdf", false],
			["get", "/api/v1/documents/{documentId}/fields", "listAgentFields", false],
			["post", "/api/v1/documents/{documentId}/complete", "completeAgentSigning", true],
			["post", "/api/v1/documents/{documentId}/change-request", "requestAgentSigningChanges", true],
			["post", "/api/v1/documents/{documentId}/decline", "declineAgentSigning", true],
		] as const) {
			const operation = document.paths[path]?.[method] as
				| { operationId?: string; security?: unknown; parameters?: Array<{ name?: string }> }
				| undefined;
			expect(operation).toEqual(
				expect.objectContaining({ operationId, security: [{ bearerAuth: [] }] }),
			);
			if (mutates) {
				expect(operation?.parameters?.map((parameter) => parameter.name)).toContain(
					"Idempotency-Key",
				);
			}
		}

		for (const [path, requestSchema, responseSchema] of [
			[
				"/api/v1/documents/{documentId}/change-request",
				AgentPartnerChangeRequestSchema,
				AgentPartnerChangeResponseSchema,
			],
			[
				"/api/v1/documents/{documentId}/decline",
				AgentPartnerDeclineRequestSchema,
				AgentPartnerDeclineResponseSchema,
			],
		] as const) {
			const operation = document.paths[path]?.post as {
				requestBody?: { content?: Record<string, { schema?: unknown }> };
				responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
			};
			expect(operation.requestBody?.content?.["application/json"]?.schema).toEqual(
				z.toJSONSchema(requestSchema),
			);
			expect(operation.responses?.["200"]?.content?.["application/json"]?.schema).toEqual(
				z.toJSONSchema(responseSchema),
			);
		}
		const serialized = JSON.stringify(document);
		for (const code of [
			"AGENT_SIGNING_WRONG_IDENTITY",
			"AGENT_SIGNING_INACTIVE",
			"AGENT_SIGNING_COMPLETED",
			"AGENT_SIGNING_CHANGES_REQUESTED",
			"AGENT_SIGNING_DECLINED",
			"AGENT_SIGNING_EXPIRED",
			"AGENT_SIGNING_DELETED",
			"INVALID_CHANGE_REQUEST",
			"INVALID_SIGNING_DECLINE",
		]) {
			expect(serialized).toContain(code);
		}
		expect(serialized).not.toMatch(/signerToken|processToken|senderSessionToken/);

		const guidance = await publicAgentContractHono.request("/agent.md");
		const markdown = await guidance.text();
		for (const phrase of [
			"Discover invited signing work",
			"Review only assigned content",
			"Complete partner signing",
			"Request creator changes",
			"Decline partner signing",
			"Poll after a partner decision",
			"Signing-state recovery",
		]) {
			expect(markdown).toContain(phrase);
		}
		expect(markdown).not.toMatch(/signerToken|processToken|senderSessionToken/);
	});
});
