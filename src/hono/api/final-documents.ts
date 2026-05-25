import { getCompletedDocumentView, getFinalDocumentByToken } from "@/db/envelope";
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
