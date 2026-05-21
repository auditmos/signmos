import {
	AddFieldsRequestSchema,
	AddRecipientsRequestSchema,
	addFields,
	addRecipients,
	controlEnvelope,
	createEnvelope,
	EnvelopeActionRequestSchema,
	EnvelopeControlError,
	envelopeLifecycleActions,
	getEnvelopeAllowedActions,
	getEnvelopeFinalizationStatus,
	getEnvelopeRetentionStatus,
	getFinalDocument,
	recordSourcePdfUploadRejection,
	resendInvitation,
	resolveVerifiedSenderSession,
	SenderStartRateLimitError,
	SenderStartRequestSchema,
	SourcePdfUploadError,
	sendEnvelope,
	startSenderEnvelope,
	toEnvelopeFieldResponse,
	toEnvelopeResponse,
	toRecipientResponse,
	toSourceDocumentResponse,
	uploadSourcePdfDocument,
	verifySenderToken,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";
import {
	getRequestIp,
	getVerifiedSenderUploadEmail,
	isPdf,
	parseNow,
	type SenderStartEnv,
	sha256Hex,
	verifyTurnstileToken,
} from "./envelope-route-helpers";

const envelopesEndpoint = createHono();
const maxSourcePdfBytes = 10 * 1024 * 1024;
envelopesEndpoint.post("/sender-start", async (c) => {
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = SenderStartRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_SENDER_START",
					message: "Sender name, email, and Turnstile token are required",
					fields: ["name", "email", "turnstileToken"],
				},
			},
			400,
		);
	}

	const requestIp = getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
	const turnstilePassed = await verifyTurnstileToken({
		env: (c.env ?? {}) as SenderStartEnv,
		token: parsed.data.turnstileToken,
		ip: requestIp,
	});
	if (!turnstilePassed) {
		return c.json(
			{
				error: {
					code: "TURNSTILE_FAILED",
					message: "Turnstile verification failed",
				},
			},
			403,
		);
	}

	try {
		const result = await startSenderEnvelope({
			name: parsed.data.name,
			email: parsed.data.email,
			requestIp,
			baseUrl: new URL(c.req.url).origin,
			idempotencyKey: c.req.header("idempotency-key") ?? undefined,
			now: parseNow(c.req.header("x-now")),
		});
		return c.json({ data: result.response }, result.reused ? 200 : 201);
	} catch (error) {
		if (error instanceof SenderStartRateLimitError) {
			return c.json(
				{
					error: {
						code: "RATE_LIMITED",
						message: "Too many sender start attempts",
						scope: error.scope,
						resetAt: error.resetAt.toISOString(),
					},
				},
				429,
			);
		}
		throw error;
	}
});

envelopesEndpoint.get("/sender-verifications/:token", async (c) => {
	const result = await verifySenderToken(c.req.param("token"), parseNow(c.req.header("x-now")));
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

envelopesEndpoint.post("/", async (c) => {
	const createdBy = c.req.header("x-internal-user-id");
	if (!createdBy) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const result = await createEnvelope({
		createdBy,
		idempotencyKey: c.req.header("idempotency-key") ?? undefined,
	});

	return c.json({ data: toEnvelopeResponse(result.envelope) }, result.reused ? 200 : 201);
});

envelopesEndpoint.post("/:id/actions", async (c) => {
	const body = await c.req.json();
	const parsed = EnvelopeActionRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_ACTION",
					message: "Invalid envelope lifecycle action",
					validValues: [...envelopeLifecycleActions],
				},
			},
			400,
		);
	}

	const sentBy = c.req.header("x-internal-user-id");
	if (!sentBy) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}
	if (parsed.data.action === "send") {
		const result = await sendEnvelope(c.req.param("id"), sentBy);
		return c.json({ data: result });
	}

	try {
		const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
		const result = await controlEnvelope(c.req.param("id"), sentBy, parsed.data.action, {
			documentsBucket: bucket,
		});
		return c.json({ data: result });
	} catch (error) {
		if (error instanceof EnvelopeControlError) {
			return c.json(
				{
					error: {
						code: error.code,
						message: "Envelope action is not allowed in the current state",
						allowedActions: error.allowedActions,
					},
				},
				409,
			);
		}
		throw error;
	}
});

envelopesEndpoint.get("/:id/status", async (c) => {
	const result = await getEnvelopeFinalizationStatus(c.req.param("id"));
	return c.json({ data: result });
});

envelopesEndpoint.get("/:id/retention", async (c) => {
	const userId = c.req.header("x-internal-user-id");
	if (!userId) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const result = await getEnvelopeRetentionStatus(
		c.req.param("id"),
		parseNow(c.req.header("x-now")),
	);
	return c.json({ data: result });
});

envelopesEndpoint.get("/:id/final-pdf", async (c) => {
	const envelopeId = c.req.param("id");
	const senderSessionToken =
		c.req.query("senderSessionToken") ?? c.req.header("x-sender-session-token");
	const senderSession = senderSessionToken
		? await resolveVerifiedSenderSession(
				senderSessionToken,
				envelopeId,
				parseNow(c.req.header("x-now")),
			)
		: null;
	if (!senderSession) {
		return c.json(
			{
				error: {
					code: "FINAL_PDF_FORBIDDEN",
					message: "Verified sender access is required",
				},
			},
			403,
		);
	}

	const document = await getFinalDocument(envelopeId);
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

	const bucket = (c.env as Env & { DOCUMENTS_BUCKET: R2Bucket }).DOCUMENTS_BUCKET;
	const object = await bucket.get(document.r2Key);
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

envelopesEndpoint.post("/:id/source-pdf", async (c) => {
	const envelopeId = c.req.param("id");
	const uploadedBy =
		c.req.header("x-internal-user-id") ??
		(await getVerifiedSenderUploadEmail(
			c.req.header("x-sender-session-token"),
			envelopeId,
			c.req.header("x-now"),
		));
	if (!uploadedBy) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const contentType = c.req.header("content-type")?.split(";")[0]?.trim() ?? "";
	const bytes = new Uint8Array(await c.req.arrayBuffer());
	if (contentType !== "application/pdf" || !isPdf(bytes)) {
		await recordSourcePdfUploadRejection({
			envelopeId,
			eventType: "source_pdf.upload_rejected",
			message: uploadedBy,
		});
		return c.json(
			{
				error: {
					code: "INVALID_SOURCE_PDF",
					message: "Source document must be a PDF",
					validValues: ["application/pdf"],
				},
			},
			400,
		);
	}
	if (bytes.byteLength > maxSourcePdfBytes) {
		await recordSourcePdfUploadRejection({
			envelopeId,
			eventType: "source_pdf.upload_too_large",
			message: uploadedBy,
		});
		return c.json(
			{
				error: {
					code: "SOURCE_PDF_TOO_LARGE",
					message: "Source PDF must be under 10 MB",
					limitBytes: maxSourcePdfBytes,
				},
			},
			413,
		);
	}

	const sha256 = await sha256Hex(bytes);
	const bucket = (c.env as Env & { DOCUMENTS_BUCKET: R2Bucket }).DOCUMENTS_BUCKET;
	try {
		const result = await uploadSourcePdfDocument({
			envelopeId,
			uploadedBy,
			idempotencyKey: c.req.header("idempotency-key") ?? undefined,
			bytes,
			sha256,
			contentType: "application/pdf",
			documentsBucket: bucket,
		});

		return c.json({ data: toSourceDocumentResponse(result.document) }, result.reused ? 200 : 201);
	} catch (error) {
		if (error instanceof SourcePdfUploadError) {
			if (error.code === "DUPLICATE_SOURCE_PDF") {
				await recordSourcePdfUploadRejection({
					envelopeId,
					eventType: "source_pdf.upload_duplicate",
					message: uploadedBy,
				});
				return c.json(
					{
						error: {
							code: "DUPLICATE_SOURCE_PDF",
							message: "Envelope already has a source PDF",
						},
					},
					409,
				);
			}
			return c.json(
				{
					error: {
						code: "ENVELOPE_NOT_DRAFT",
						message: "Source PDFs can only be uploaded while the envelope is draft",
					},
				},
				409,
			);
		}
		throw error;
	}
});

envelopesEndpoint.post("/:id/recipients", async (c) => {
	const createdBy = c.req.header("x-internal-user-id");
	if (!createdBy) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const parsed = AddRecipientsRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_RECIPIENTS",
					message: "Recipients must include 1 to 10 valid name and email entries",
					limit: 10,
				},
			},
			400,
		);
	}

	const recipients = await addRecipients(c.req.param("id"), parsed.data);
	return c.json({ data: recipients.map(toRecipientResponse) }, 201);
});

envelopesEndpoint.post("/:id/recipients/:recipientId/resend", async (c) => {
	const senderId = c.req.header("x-internal-user-id");
	if (!senderId) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const result = await resendInvitation(c.req.param("id"), c.req.param("recipientId"));
	return c.json({ data: result }, 201);
});

envelopesEndpoint.post("/:id/fields", async (c) => {
	const userId = c.req.header("x-internal-user-id");
	if (!userId) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const parsed = AddFieldsRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_FIELDS",
					message: "Fields must use valid type, page, geometry, and recipient values",
					validFieldTypes: ["signature", "date"],
					allowedActions: ["add_fields"],
				},
			},
			400,
		);
	}

	let fields: Awaited<ReturnType<typeof addFields>>;
	try {
		fields = await addFields(c.req.param("id"), parsed.data);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to create fields";
		if (message === "Envelope must be draft") {
			return c.json(
				{
					error: {
						code: "ENVELOPE_NOT_DRAFT",
						message: "Fields can only be changed while the envelope is draft",
						allowedActions: getEnvelopeAllowedActions("draft"),
					},
				},
				409,
			);
		}
		if (message === "Field recipient not found") {
			return c.json(
				{
					error: {
						code: "INVALID_FIELDS",
						message: "Fields must use valid type, page, geometry, and recipient values",
						validFieldTypes: ["signature", "date"],
						allowedActions: ["add_fields"],
					},
				},
				400,
			);
		}
		throw error;
	}
	return c.json({ data: fields.map(toEnvelopeFieldResponse) }, 201);
});

export default envelopesEndpoint;
