import { z } from "zod";
import { agentV1IdentityOperation } from "@/db/agentic-access/schema";
import { createHono } from "./factory";

export const publicAgentContractHono = createHono();

publicAgentContractHono.get("/agent.md", (c) =>
	c.text(buildAgentGuidance(), 200, { "content-type": "text/markdown; charset=UTF-8" }),
);

publicAgentContractHono.get("/openapi.json", (c) => c.json(buildAgentOpenApiDocument()));

function buildAgentOpenApiDocument() {
	return {
		openapi: "3.1.0",
		info: {
			title: "Signmos Agent API",
			version: "1.0.0",
			description: "Bearer-authenticated personal document automation for Signmos.",
		},
		paths: {
			[agentV1IdentityOperation.publicPath]: {
				get: {
					operationId: agentV1IdentityOperation.operationId,
					summary: "Resolve the current verified Agentic identity",
					security: [{ bearerAuth: [] }],
					responses: {
						"200": {
							description: "Authenticated identity and safe token metadata",
							content: {
								"application/json": {
									schema: z.toJSONSchema(agentV1IdentityOperation.responseSchema),
								},
							},
						},
						"401": {
							description: "Missing or invalid Bearer token",
							content: {
								"application/json": {
									schema: z.toJSONSchema(agentV1IdentityOperation.errorSchema),
								},
							},
						},
					},
				},
			},
		},
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "SignmosToken" },
			},
		},
	};
}

function buildAgentGuidance(): string {
	return `# Signmos Agent API

Read this guide and [/openapi.json](/openapi.json) before acting. Signmos Agentic tokens represent one verified email and may eventually send, sign, decline, cancel, and delete documents as that identity.

## Secret handling

Provide the token through the \`SIGNMOS_TOKEN\` environment variable. Never paste it into prompts, URLs, issue bodies, source control, or logs. Send it only in the HTTP header \`Authorization: Bearer $SIGNMOS_TOKEN\`.

## Confirm identity

The first available v1 operation confirms the email and safe token metadata represented by your credential:

\`\`\`sh
curl --fail --silent --show-error \\
  -H "Authorization: Bearer $SIGNMOS_TOKEN" \\
  "$SIGNMOS_BASE_URL/api/v1/me"
\`\`\`

Use only documented operations, remain within the user's stated goal and verified identity, and do not attempt browser-session or internal-header authentication.
`;
}
