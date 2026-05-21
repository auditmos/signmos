import {
	ChangeRequestSigningRequestSchema,
	CompleteSigningRequestSchema,
	completeSigning,
	DeclineSigningRequestSchema,
	declineSigning,
	getEnvelopeStatus,
	getSignerFinalDocument,
	getSignerSession,
	getSignerSourceDocument,
	getSigningBlockedAllowedActions,
	recordPartnerLinkExpired,
	requestSigningChanges,
	resolveSignerToken,
	SigningChangeRequestError,
	SigningCompletionBlockedError,
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

signingEndpoint.get("/:token/source-pdf", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	const document = await getSignerSourceDocument(token);
	if (!document) {
		return c.json(
			{
				error: {
					code: "SOURCE_PDF_NOT_FOUND",
					message: "Source PDF is not available",
				},
			},
			404,
		);
	}

	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	const object = await bucket?.get(document.r2Key);
	if (!object) {
		return c.json(
			{
				error: {
					code: "SOURCE_PDF_NOT_FOUND",
					message: "Source PDF is not available",
				},
			},
			404,
		);
	}

	return new Response(await object.arrayBuffer(), {
		headers: { "content-type": document.contentType },
	});
});

signingEndpoint.get("/:token/final-pdf", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	const document = await getSignerFinalDocument(token);
	if (!document) {
		return c.json(
			{
				error: {
					code: "FINAL_PDF_NOT_FOUND",
					message: "Completed PDF is not available",
				},
			},
			404,
		);
	}

	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	const object = await bucket?.get(document.r2Key);
	if (!object) {
		return c.json(
			{
				error: {
					code: "FINAL_PDF_NOT_FOUND",
					message: "Completed PDF is not available",
				},
			},
			404,
		);
	}

	return new Response(await object.arrayBuffer(), {
		headers: { "content-type": document.contentType },
	});
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
	try {
		return c.json({ data: await completeSigning(token, parsed.data, { documentsBucket: bucket }) });
	} catch (error) {
		if (error instanceof SigningCompletionBlockedError) {
			return c.json(
				{
					error: {
						code: "SIGNING_BLOCKED",
						message: "Envelope is waiting for sender revision",
						allowedActions: getSigningBlockedAllowedActions(error.status),
					},
				},
				409,
			);
		}
		throw error;
	}
});

signingEndpoint.post("/:token/change-request", async (c) => {
	const token = await getUsableToken(c.req.param("token"), c.req.header("x-now"));
	if (token instanceof Response) return token;

	const parsed = ChangeRequestSigningRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_CHANGE_REQUEST",
					message: "Change request comment is required",
				},
			},
			400,
		);
	}

	try {
		return c.json({ data: await requestSigningChanges(token, parsed.data) });
	} catch (error) {
		if (error instanceof SigningChangeRequestError) {
			return c.json(
				{
					error: {
						code: "SIGNING_BLOCKED",
						message: "Envelope is not open for change requests",
					},
				},
				409,
			);
		}
		throw error;
	}
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
	const envelopeStatus = await getEnvelopeStatus(token.envelopeId);
	if (envelopeStatus === "deleted") {
		return Response.json(
			{
				error: {
					code: "ENVELOPE_DELETED",
					message: "This document was deleted by the sender",
				},
			},
			{ status: 410 },
		);
	}
	if (envelopeStatus === "expired") {
		return Response.json(
			{
				error: {
					code: "ENVELOPE_EXPIRED",
					message: "This signing link is no longer active",
				},
			},
			{ status: 410 },
		);
	}
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
