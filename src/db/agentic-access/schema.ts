import { z } from "zod";

export const AgentV1MeResponseSchema = z.object({
	data: z.object({
		principal: z.object({
			email: z.string().email(),
			actorType: z.literal("agent"),
		}),
		token: z.object({
			id: z.string().uuid(),
			name: z.string().min(1),
			hint: z.string().min(1),
			createdAt: z.string().datetime(),
			lastUsedAt: z.string().datetime(),
		}),
	}),
});

export const AgentV1AuthenticationErrorSchema = z.object({
	error: z.object({
		code: z.literal("AGENTIC_TOKEN_REQUIRED"),
		message: z.string(),
	}),
});

export const agentV1IdentityOperation = {
	method: "get",
	relativePath: "/me",
	publicPath: "/api/v1/me",
	operationId: "getAgentIdentity",
	responseSchema: AgentV1MeResponseSchema,
	errorSchema: AgentV1AuthenticationErrorSchema,
} as const;
