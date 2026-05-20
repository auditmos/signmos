import {
	AddFieldsRequestSchema,
	AddRecipientsRequestSchema,
	addFields,
	addRecipients,
	attachSourceDocument,
	createEnvelope,
	EnvelopeActionRequestSchema,
	envelopeLifecycleActions,
	getEnvelopeFinalizationStatus,
	getFinalDocument,
	resendInvitation,
	sendEnvelope,
	toEnvelopeFieldResponse,
	toEnvelopeResponse,
	toRecipientResponse,
	toSourceDocumentResponse,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const envelopesEndpoint = createHono();
const maxSourcePdfBytes = 10 * 1024 * 1024;

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
	const result = await sendEnvelope(c.req.param("id"), sentBy);
	return c.json({ data: result });
});

envelopesEndpoint.get("/:id/status", async (c) => {
	const result = await getEnvelopeFinalizationStatus(c.req.param("id"));
	return c.json({ data: result });
});

envelopesEndpoint.get("/:id/final-pdf", async (c) => {
	const document = await getFinalDocument(c.req.param("id"));
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
	const uploadedBy = c.req.header("x-internal-user-id");
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

	const envelopeId = c.req.param("id");
	const sha256 = await sha256Hex(bytes);
	const r2Key = `envelopes/${envelopeId}/source.pdf`;
	const bucket = (c.env as Env & { DOCUMENTS_BUCKET: R2Bucket }).DOCUMENTS_BUCKET;
	await bucket.put(r2Key, bytes, {
		httpMetadata: { contentType: "application/pdf" },
	});

	const result = await attachSourceDocument({
		envelopeId,
		uploadedBy,
		idempotencyKey: c.req.header("idempotency-key") ?? undefined,
		r2Key,
		sha256,
		byteSize: bytes.byteLength,
		contentType: "application/pdf",
	});

	return c.json({ data: toSourceDocumentResponse(result.document) }, result.reused ? 200 : 201);
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
					},
				},
				400,
			);
		}
		throw error;
	}
	return c.json({ data: fields.map(toEnvelopeFieldResponse) }, 201);
});

function isPdf(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 5 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46 &&
		bytes[4] === 0x2d
	);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default envelopesEndpoint;
