import {
	CompleteSigningRequestSchema,
	completeSigning,
	DeclineSigningRequestSchema,
	declineSigning,
	getSignerSession,
	resolveSignerToken,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const signingEndpoint = createHono();

signingEndpoint.get("/:token", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	return c.json({ data: await getSignerSession(token) });
});

signingEndpoint.post("/:token/complete", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	const parsed = CompleteSigningRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_SIGNING_COMPLETION",
					message: "Signature name and signing date are required",
				},
			},
			400,
		);
	}

	return c.json({ data: await completeSigning(token, parsed.data) });
});

signingEndpoint.post("/:token/decline", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	const parsed = DeclineSigningRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_SIGNING_DECLINE",
					message: "Decline reason is required",
				},
			},
			400,
		);
	}

	return c.json({ data: await declineSigning(token, parsed.data) });
});

async function getUsableToken(tokenValue: string, nowHeader: string | undefined) {
	const token = await resolveSignerToken(tokenValue);
	if (!token) {
		return Response.json(
			{
				error: {
					code: "TOKEN_NOT_FOUND",
					message: "Signing token was not found",
				},
			},
			{ status: 404 },
		);
	}

	const now = new Date(nowHeader ?? Date.now());
	if (token.expiresAt <= now) {
		return Response.json(
			{
				error: {
					code: "EXPIRED_TOKEN",
					message: "Signing token has expired",
				},
			},
			{ status: 410 },
		);
	}

	return token;
}

export default signingEndpoint;
