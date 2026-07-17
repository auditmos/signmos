import { getCookie, setCookie } from "hono/cookie";
import {
	authorizeMinimalHistoryDocument,
	getHistoryCompletedDocumentView,
	getHistoryFinalDocument,
	inspectHistoryAccessLink,
	listMinimalHistoryDocuments,
	redeemHistoryAccessLink,
	requestHistoryAccess,
	resolveHistorySession,
} from "@/db/history-access";
import { createHono } from "@/hono/factory";

const historyAccessEndpoint = createHono();

historyAccessEndpoint.get("/access-links/:credential", async (c) => {
	const nowHeader = c.req.header("x-now");
	const inspection = await inspectHistoryAccessLink(
		c.req.param("credential"),
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	c.header("Referrer-Policy", "no-referrer");
	return c.json({ data: inspection });
});

historyAccessEndpoint.post("/access-links/:credential/redeem", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use the confirmation page to continue" } },
			403,
		);
	}
	const nowHeader = c.req.header("x-now");
	const result = await redeemHistoryAccessLink(
		c.req.param("credential"),
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (result.status !== "authenticated") {
		const errors = {
			unknown: { code: "HISTORY_LINK_UNKNOWN", message: "This My documents link is not valid" },
			consumed: {
				code: "HISTORY_LINK_CONSUMED",
				message: "This My documents link has already been used",
			},
			expired: { code: "HISTORY_LINK_EXPIRED", message: "This My documents link has expired" },
			revoked: {
				code: "HISTORY_LINK_REVOKED",
				message: "This My documents link is no longer active",
			},
		} as const;
		const status = result.status === "unknown" ? 404 : result.status === "consumed" ? 409 : 410;
		return c.json({ error: errors[result.status] }, status);
	}
	setCookie(c, "signmos_history_session", result.rawSession, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		expires: result.expiresAt,
		maxAge: 8 * 60 * 60,
	});
	return c.json({ data: { status: result.status, redirectUrl: "/my-documents" } }, 201);
});

historyAccessEndpoint.get("/documents", async (c) => {
	const nowHeader = c.req.header("x-now");
	const session = await resolveHistorySession(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (!session) {
		return c.json(
			{ error: { code: "HISTORY_SESSION_REQUIRED", message: "Request a new My documents link" } },
			401,
		);
	}
	return c.json({ data: { documents: await listMinimalHistoryDocuments(session.email) } });
});

historyAccessEndpoint.get("/documents/:envelopeId", async (c) => {
	const nowHeader = c.req.header("x-now");
	const session = await resolveHistorySession(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (!session) {
		return c.json(
			{ error: { code: "HISTORY_SESSION_REQUIRED", message: "Request a new My documents link" } },
			401,
		);
	}
	const document = await authorizeMinimalHistoryDocument(session.email, c.req.param("envelopeId"));
	if (!document) {
		return c.json(
			{
				error: {
					code: "HISTORY_DOCUMENT_NOT_FOUND",
					message: "Document not found for this My documents session",
				},
			},
			404,
		);
	}
	const view = await getHistoryCompletedDocumentView(
		session.email,
		document.envelopeId,
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (!view) {
		return c.json(
			{
				error: {
					code: "HISTORY_DOCUMENT_NOT_FOUND",
					message: "Document not found for this My documents session",
				},
			},
			404,
		);
	}
	return c.json({ data: view });
});

historyAccessEndpoint.get("/documents/:envelopeId/pdf", async (c) => {
	const nowHeader = c.req.header("x-now");
	const session = await resolveHistorySession(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (!session) {
		return c.json(
			{ error: { code: "HISTORY_SESSION_REQUIRED", message: "Request a new My documents link" } },
			401,
		);
	}
	const document = await getHistoryFinalDocument(session.email, c.req.param("envelopeId"));
	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	const object = document ? await bucket?.get(document.r2Key) : null;
	if (!document || !bucket || !object) {
		return c.json(
			{
				error: {
					code: "HISTORY_DOCUMENT_NOT_FOUND",
					message: "Document not found for this My documents session",
				},
			},
			404,
		);
	}
	return new Response(await object.arrayBuffer(), {
		headers: { "content-type": document.contentType },
	});
});

historyAccessEndpoint.post("/access-requests", async (c) => {
	if (c.env.CLOUDFLARE_ENV === "production") {
		return c.json(
			{
				error: {
					code: "HISTORY_ACCESS_NOT_AVAILABLE",
					message: "My documents access is not available in this environment",
				},
			},
			404,
		);
	}
	const body: unknown = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
		return c.json({ error: { code: "INVALID_EMAIL", message: "A valid email is required" } }, 400);
	}
	const nowHeader = c.req.header("x-now");
	const result = await requestHistoryAccess(body.email, {
		emailDelivery: {
			env: c.env,
			baseUrl: new URL(c.req.url).origin,
		},
		now: nowHeader ? new Date(nowHeader) : undefined,
	});
	const exposeDebugLink =
		c.req.header("x-signmos-debug") === "history-access-link" &&
		c.env.CLOUDFLARE_ENV !== "production" &&
		result.accessUrl;

	return c.json(
		{
			data: {
				status: result.status,
				...(exposeDebugLink ? { debug: { accessUrl: result.accessUrl } } : {}),
			},
		},
		202,
	);
});

export default historyAccessEndpoint;
