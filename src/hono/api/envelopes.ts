import {
	attachSourceDocument,
	createEnvelope,
	EnvelopeActionRequestSchema,
	envelopeLifecycleActions,
	toEnvelopeResponse,
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

	return c.json(
		{
			error: {
				code: "ACTION_NOT_IMPLEMENTED",
				message: "Envelope lifecycle action is not implemented in this slice",
				validValues: [...envelopeLifecycleActions],
			},
		},
		501,
	);
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
