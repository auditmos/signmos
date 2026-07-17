import { z } from "zod";
import {
	AgentDocumentCatalogResponseSchema,
	AgentDocumentDetailResponseSchema,
	AgentDocumentHistoryResponseSchema,
	AgentDocumentStatusResponseSchema,
	AgentV1MeResponseSchema,
} from "@/db/agentic-access/schema";
import { publicAgentContractHono } from "@/hono/public-agent-contract";

describe("agentic onboarding public contract", () => {
	it("publishes secret-free guidance and OpenAPI from the runtime identity schema", async () => {
		// Issue #44 publication assumptions before RED:
		// - Both resources are public root paths and never inspect Authorization.
		// - The identity response schema is the exact Zod trust boundary used by the handler.
		// - Guidance references the environment variable, never a generated token value.
		const canary = "signmos_DO_NOT_PUBLISH_CANARY";
		const guidance = await publicAgentContractHono.request("/agent.md", {
			headers: { authorization: `Bearer ${canary}` },
		});
		expect(guidance.status).toBe(200);
		expect(guidance.headers.get("content-type")).toMatch(/^text\/markdown/);
		const markdown = await guidance.text();
		expect(markdown).toContain("/api/v1/me");
		expect(markdown).toContain("Authorization: Bearer");
		expect(markdown).toContain("$SIGNMOS_TOKEN");
		expect(markdown).not.toContain(canary);

		const openapiResponse = await publicAgentContractHono.request("/openapi.json", {
			headers: { authorization: `Bearer ${canary}` },
		});
		expect(openapiResponse.status).toBe(200);
		const document = (await openapiResponse.json()) as {
			openapi: string;
			paths: Record<string, unknown>;
		};
		expect(document.openapi).toBe("3.1.0");
		expect(document.paths).toEqual(
			expect.objectContaining({
				"/api/v1/me": {
					get: expect.objectContaining({
						operationId: "getAgentIdentity",
						security: [{ bearerAuth: [] }],
						responses: expect.objectContaining({
							"200": expect.objectContaining({
								content: {
									"application/json": {
										schema: z.toJSONSchema(AgentV1MeResponseSchema),
									},
								},
							}),
						}),
					}),
				},
			}),
		);
		expect(JSON.stringify(document)).not.toContain(canary);
	});

	it("agent API contract publishes read-only document discovery, inspection, and download", async () => {
		// Issue #46 contract assumptions before RED:
		// - Runtime Zod schemas remain the source for every JSON success/error projection.
		// - All document routes require Bearer authentication and expose no browser/process credentials.
		// - PDF is an application/pdf binary response; filters and machine recovery are explicit.
		const openapiResponse = await publicAgentContractHono.request("/openapi.json");
		const document = (await openapiResponse.json()) as {
			paths: Record<string, Record<string, unknown>>;
		};
		const expectedOperations = {
			"/api/v1/documents": "listAgentDocuments",
			"/api/v1/documents/{documentId}": "getAgentDocument",
			"/api/v1/documents/{documentId}/status": "getAgentDocumentStatus",
			"/api/v1/documents/{documentId}/history": "getAgentDocumentHistory",
			"/api/v1/documents/{documentId}/pdf": "downloadAgentFinalPdf",
		};
		for (const [path, operationId] of Object.entries(expectedOperations)) {
			const operation = document.paths[path]?.get as
				| { operationId?: string; security?: unknown }
				| undefined;
			expect(operation).toEqual(
				expect.objectContaining({
					operationId,
					security: [{ bearerAuth: [] }],
				}),
			);
		}
		for (const [path, schema] of [
			["/api/v1/documents", AgentDocumentCatalogResponseSchema],
			["/api/v1/documents/{documentId}", AgentDocumentDetailResponseSchema],
			["/api/v1/documents/{documentId}/status", AgentDocumentStatusResponseSchema],
			["/api/v1/documents/{documentId}/history", AgentDocumentHistoryResponseSchema],
		] as const) {
			const operation = document.paths[path]?.get as {
				responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
			};
			expect(operation.responses?.["200"]?.content?.["application/json"]?.schema).toEqual(
				z.toJSONSchema(schema),
			);
		}

		const catalog = document.paths["/api/v1/documents"]?.get as {
			parameters?: Array<{ name: string }>;
		};
		expect(catalog.parameters?.map((parameter) => parameter.name)).toEqual([
			"search",
			"role",
			"group",
			"status",
			"page",
		]);
		const serialized = JSON.stringify(document);
		expect(serialized).toContain('"application/pdf"');
		expect(serialized).toContain('"format":"binary"');
		expect(serialized).toContain("AGENT_DOCUMENT_NOT_FOUND");
		expect(serialized).toContain("AGENT_FINAL_PDF_UNAVAILABLE");
		expect(serialized).toContain("retryable");
		expect(serialized).not.toMatch(/senderSessionToken|signerToken|x-internal-user-id/);

		const guidance = await publicAgentContractHono.request("/agent.md");
		const markdown = await guidance.text();
		for (const phrase of [
			"Confirm identity",
			"Discover documents",
			"Creator, signer, and dual roles",
			"Poll document status",
			"Download a completed PDF",
			"Revoked, deleted, or unavailable",
		]) {
			expect(markdown).toContain(phrase);
		}
	});
});
