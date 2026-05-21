import {
	CompleteSigningRequestSchema,
	completeSigning,
	DeclineSigningRequestSchema,
	declineSigning,
	getSignerSession,
	recordPartnerLinkExpired,
	resolveSignerToken,
	verifyPartnerToken,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const signingEndpoint = createHono();

signingEndpoint.get("/verifications/:token", async (c) => {
	const result = await verifyPartnerToken(c.req.param("token"), parseNow(c.req.header("x-now")));
	if (!result.ok) {
		return c.json(
			{
				error: {
					code: result.error.code,
					message: result.error.message,
				},
			},
			result.error.status,
		);
	}

	return c.json({ data: result.data });
});

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

	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	return c.json({ data: await completeSigning(token, parsed.data, { documentsBucket: bucket }) });
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
		await recordPartnerLinkExpired(token);
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
	if (!token.verifiedAt) {
		return Response.json(
			{
				error: {
					code: "PARTNER_VERIFICATION_REQUIRED",
					message: "Partner email verification is required before signing",
					verificationUrl: `/api/signing/verifications/${token.token}`,
				},
			},
			{ status: 403 },
		);
	}

	return token;
}

function parseNow(nowHeader: string | undefined): Date {
	return new Date(nowHeader ?? Date.now());
}

export default signingEndpoint;
