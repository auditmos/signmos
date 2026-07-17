import { authenticateAgenticBearer } from "@/db/agentic-access";
import { AgentV1MeResponseSchema, agentV1IdentityOperation } from "@/db/agentic-access/schema";
import { createHono } from "@/hono/factory";
import { getRequestIp } from "./envelope-route-helpers";

const agentV1Endpoint = createHono();

agentV1Endpoint.get(agentV1IdentityOperation.relativePath, async (c) => {
	const nowHeader = c.req.header("x-now");
	const principal = await authenticateAgenticBearer({
		authorization: c.req.header("authorization"),
		now: nowHeader ? new Date(nowHeader) : undefined,
		requestIp: getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	});
	if (!principal) {
		return c.json(
			{
				error: {
					code: "AGENTIC_TOKEN_REQUIRED",
					message: "Use Authorization: Bearer <token>",
				},
			},
			401,
		);
	}
	const response = AgentV1MeResponseSchema.parse({
		data: {
			principal: { email: principal.email, actorType: principal.actorType },
			token: {
				id: principal.token.id,
				name: principal.token.name,
				hint: principal.token.hint,
				createdAt: principal.token.createdAt.toISOString(),
				lastUsedAt: principal.token.lastUsedAt.toISOString(),
			},
		},
	});
	return c.json(response);
});

export default agentV1Endpoint;
