import {
	getCompletedDocumentView,
	getFinalDocumentByToken,
	regenerateFinalDocumentArtifact,
} from "@/db/envelope";
import { isCurrentFinalPdfArtifact } from "@/db/envelope/final-pdf-renderer";
import { createHono } from "@/hono/factory";

const finalDocumentsEndpoint = createHono();

finalDocumentsEndpoint.get("/:token/pdf", async (c) => {
	const document = await getFinalDocumentByToken(c.req.param("token"), {
		now: parseNow(c.req.header("x-now")),
	});
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
	if (!bucket || !object) {
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

	const bytes = new Uint8Array(await object.arrayBuffer());
	const isCurrent = await isCurrentFinalPdfArtifact(bytes);
	const repaired = isCurrent ? null : await tryRegenerateFinalDocument(document, bucket);

	const responseBytes = repaired?.bytes ?? bytes;
	return new Response(toArrayBuffer(responseBytes), {
		headers: { "content-type": repaired?.document.contentType ?? document.contentType },
	});
});

finalDocumentsEndpoint.get("/:token", async (c) => {
	const view = await getCompletedDocumentView(c.req.param("token"), {
		now: parseNow(c.req.header("x-now")),
	});
	if (!view) {
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

	return c.json({ data: view });
});

export default finalDocumentsEndpoint;

function parseNow(nowHeader: string | undefined): Date {
	return new Date(nowHeader ?? Date.now());
}

async function tryRegenerateFinalDocument(
	document: Awaited<ReturnType<typeof getFinalDocumentByToken>>,
	bucket: R2Bucket,
) {
	if (!document) return null;
	try {
		return await regenerateFinalDocumentArtifact(document, { documentsBucket: bucket });
	} catch {
		return null;
	}
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
