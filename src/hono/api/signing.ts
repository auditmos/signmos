import { resolveSignerToken } from "@/db/envelope";
import { createHono } from "@/hono/factory";

const signingEndpoint = createHono();

signingEndpoint.get("/:token", async (c) => {
	const token = await resolveSignerToken(c.req.param("token"));
	if (!token) {
		return c.json(
			{
				error: {
					code: "TOKEN_NOT_FOUND",
					message: "Signing token was not found",
				},
			},
			404,
		);
	}

	const now = new Date(c.req.header("x-now") ?? Date.now());
	if (token.expiresAt <= now) {
		return c.json(
			{
				error: {
					code: "EXPIRED_TOKEN",
					message: "Signing token has expired",
				},
			},
			410,
		);
	}

	return c.json({
		data: {
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
		},
	});
});

export default signingEndpoint;
