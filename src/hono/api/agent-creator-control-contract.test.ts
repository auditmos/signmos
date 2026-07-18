import { z } from "zod";
import {
	AgentCreatorControlRequestSchema,
	AgentCreatorControlResponseSchema,
	AgentCreatorRetentionResponseSchema,
} from "@/db/agentic-access/creator-controls-schema";
import { publicAgentContractHono } from "@/hono/public-agent-contract";

describe("agent API contract revision and creator controls", () => {
	it("publishes revision recovery, controls, retention, idempotency, and lifecycle errors", async () => {
		const response = await publicAgentContractHono.request("/openapi.json");
		const document = (await response.json()) as {
			paths: Record<string, Record<string, unknown>>;
		};
		const action = document.paths["/api/v1/documents/{documentId}/actions"]?.post as {
			operationId?: string;
			security?: unknown;
			parameters?: Array<{ name?: string }>;
			requestBody?: { content?: Record<string, { schema?: unknown }> };
			responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
		};
		expect(action).toEqual(
			expect.objectContaining({
				operationId: "controlAgentDocument",
				security: [{ bearerAuth: [] }],
			}),
		);
		expect(action.parameters?.map((parameter) => parameter.name)).toContain("Idempotency-Key");
		expect(action.requestBody?.content?.["application/json"]?.schema).toEqual(
			z.toJSONSchema(AgentCreatorControlRequestSchema),
		);
		expect(action.responses?.["200"]?.content?.["application/json"]?.schema).toEqual(
			z.toJSONSchema(AgentCreatorControlResponseSchema),
		);

		const retention = document.paths["/api/v1/documents/{documentId}/retention"]?.get as {
			operationId?: string;
			security?: unknown;
			parameters?: Array<{ name?: string }>;
			responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
		};
		expect(retention).toEqual(
			expect.objectContaining({
				operationId: "getAgentDocumentRetention",
				security: [{ bearerAuth: [] }],
			}),
		);
		expect(retention.parameters?.map((parameter) => parameter.name)).not.toContain(
			"Idempotency-Key",
		);
		expect(retention.responses?.["200"]?.content?.["application/json"]?.schema).toEqual(
			z.toJSONSchema(AgentCreatorRetentionResponseSchema),
		);

		const revision = document.paths["/api/v1/documents/{documentId}/source-pdf"]?.put as {
			summary?: string;
		};
		expect(revision.summary).toMatch(/initial|revised|revision/i);
		const serialized = JSON.stringify(document);
		for (const code of [
			"INVALID_CREATOR_CONTROL",
			"ENVELOPE_ACTION_BLOCKED",
			"ENVELOPE_NOT_DRAFT",
			"RECIPIENT_FIELDS_REQUIRED",
			"IDEMPOTENCY_CONFLICT",
		]) {
			expect(serialized).toContain(code);
		}

		const guidance = await publicAgentContractHono.request("/agent.md");
		const markdown = await guidance.text();
		for (const phrase of [
			"Recover from requested changes",
			"Upload a revision",
			"Replace cleared fields",
			"Cancel or expire",
			"Delete and revoke",
			"Inspect retention",
		]) {
			expect(markdown).toContain(phrase);
		}
		expect(markdown).not.toMatch(/signerToken|processToken|senderSessionToken/);
	});
});
