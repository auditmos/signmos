import { z } from "zod";
import { AgentV1MeResponseSchema } from "@/db/agentic-access/schema";
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
		expect(document.paths).toEqual({
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
		});
		expect(JSON.stringify(document)).not.toContain(canary);
	});
});
