import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
	authorizeMinimalHistoryDocument,
	getHistoryCompletedDocumentView,
	getHistoryFinalDocument,
	HistoryRequestRateLimitError,
	historyCatalogGroups,
	historyCatalogRoles,
	inspectHistoryAccessLink,
	listHistoryDocuments,
	recordHistoryDocumentAudit,
	redeemHistoryAccessLink,
	requestHistoryAccess,
	resolveHistorySessionState,
	revokeHistorySession,
} from "@/db/history-access";
import { createHono } from "@/hono/factory";
import { getRequestIp, type SenderStartEnv, verifyTurnstileToken } from "./envelope-route-helpers";
import { type HistoryErrorCode, historyError } from "./history-errors";

const historyAccessEndpoint = createHono();
const HistoryAccessRequestSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	turnstileToken: z.string().min(1),
});
const HistoryCatalogQuerySchema = z.object({
	search: z.string().trim().max(200).optional(),
	role: z.enum(historyCatalogRoles).optional(),
	group: z.enum(historyCatalogGroups).optional(),
	status: z
		.enum([
			"awaiting_verification",
			"draft",
			"changes_requested",
			"sent",
			"completed",
			"declined",
			"expired",
		])
		.optional(),
	page: z.coerce.number().int().positive().default(1),
});

historyAccessEndpoint.get("/access-links/:credential", async (c) => {
	const nowHeader = c.req.header("x-now");
	const inspection = await inspectHistoryAccessLink(
		c.req.param("credential"),
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
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
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (result.status !== "authenticated") {
		const codes: Record<typeof result.status, HistoryErrorCode> = {
			unknown: "HISTORY_LINK_UNKNOWN",
			consumed: "HISTORY_LINK_CONSUMED",
			expired: "HISTORY_LINK_EXPIRED",
			revoked: "HISTORY_LINK_REVOKED",
		};
		const status = result.status === "unknown" ? 404 : result.status === "consumed" ? 409 : 410;
		return c.json(historyError(codes[result.status]), status);
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

historyAccessEndpoint.post("/session/sign-out", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use My documents to sign out" } },
			403,
		);
	}
	const nowHeader = c.req.header("x-now");
	await revokeHistorySession(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	deleteCookie(c, "signmos_history_session", {
		path: "/",
		secure: true,
		httpOnly: true,
		sameSite: "Lax",
	});
	return c.body(null, 204);
});

historyAccessEndpoint.get("/documents", async (c) => {
	const nowHeader = c.req.header("x-now");
	const sessionState = await resolveHistorySessionState(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (sessionState.state !== "active") {
		return c.json(
			historyError(
				sessionState.state === "expired" ? "HISTORY_SESSION_EXPIRED" : "HISTORY_SESSION_REQUIRED",
			),
			401,
		);
	}
	const query = HistoryCatalogQuerySchema.safeParse(c.req.query());
	if (!query.success) {
		return c.json(
			{
				error: {
					code: "INVALID_HISTORY_CATALOG_QUERY",
					message: "Use a positive page and supported history filters",
				},
			},
			400,
		);
	}
	return c.json({
		data: await listHistoryDocuments({ email: sessionState.session.email, ...query.data }),
	});
});

historyAccessEndpoint.get("/documents/:envelopeId", async (c) => {
	const nowHeader = c.req.header("x-now");
	const sessionState = await resolveHistorySessionState(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (sessionState.state !== "active") {
		return c.json(
			historyError(
				sessionState.state === "expired" ? "HISTORY_SESSION_EXPIRED" : "HISTORY_SESSION_REQUIRED",
			),
			401,
		);
	}
	const session = sessionState.session;
	const document = await authorizeMinimalHistoryDocument(session.email, c.req.param("envelopeId"));
	if (!document) {
		return c.json(historyError("HISTORY_DOCUMENT_NOT_FOUND"), 404);
	}
	const view = await getHistoryCompletedDocumentView(
		session.email,
		document.envelopeId,
		nowHeader ? new Date(nowHeader) : new Date(),
	);
	if (!view) {
		return c.json(historyError("HISTORY_DOCUMENT_NOT_FOUND"), 404);
	}
	await recordHistoryDocumentAudit({
		session,
		envelopeId: document.envelopeId,
		eventType: "history.completed.opened",
		requestIp: getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	});
	return c.json({ data: view });
});

historyAccessEndpoint.get("/documents/:envelopeId/pdf", async (c) => {
	const nowHeader = c.req.header("x-now");
	const sessionState = await resolveHistorySessionState(
		getCookie(c, "signmos_history_session") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (sessionState.state !== "active") {
		return c.json(
			historyError(
				sessionState.state === "expired" ? "HISTORY_SESSION_EXPIRED" : "HISTORY_SESSION_REQUIRED",
			),
			401,
		);
	}
	const session = sessionState.session;
	const document = await getHistoryFinalDocument(session.email, c.req.param("envelopeId"));
	const bucket = (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)?.DOCUMENTS_BUCKET;
	const object = document ? await bucket?.get(document.r2Key) : null;
	if (!document || !bucket || !object) {
		return c.json(historyError("HISTORY_DOCUMENT_NOT_FOUND"), 404);
	}
	await recordHistoryDocumentAudit({
		session,
		envelopeId: c.req.param("envelopeId"),
		eventType: "history.final_pdf.downloaded",
		requestIp: getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	});
	return new Response(await object.arrayBuffer(), {
		headers: { "content-type": document.contentType },
	});
});

historyAccessEndpoint.post("/access-requests", async (c) => {
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = HistoryAccessRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_HISTORY_ACCESS_REQUEST",
					message: "A valid email and Turnstile token are required",
					fields: ["email", "turnstileToken"],
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
			{ error: { code: "TURNSTILE_FAILED", message: "Turnstile verification failed" } },
			403,
		);
	}
	const nowHeader = c.req.header("x-now");
	const idempotencyKey = c.req.header("idempotency-key")?.trim();
	if (!idempotencyKey) {
		return c.json(
			{
				error: {
					code: "IDEMPOTENCY_KEY_REQUIRED",
					message: "An Idempotency-Key header is required",
				},
			},
			400,
		);
	}
	let result: Awaited<ReturnType<typeof requestHistoryAccess>>;
	try {
		result = await requestHistoryAccess(parsed.data.email, {
			emailDelivery: {
				env: c.env,
				baseUrl: new URL(c.req.url).origin,
			},
			idempotencyKey,
			requestIp,
			now: nowHeader ? new Date(nowHeader) : undefined,
		});
	} catch (error) {
		if (error instanceof HistoryRequestRateLimitError) {
			return c.json(
				{
					error: {
						code: "RATE_LIMITED",
						message: "Too many My documents access requests",
						scope: error.scope,
						resetAt: error.resetAt.toISOString(),
					},
				},
				429,
			);
		}
		throw error;
	}
	const exposeDebugLink =
		c.req.header("x-signmos-debug") === "history-access-link" &&
		(c.env as Env | undefined)?.CLOUDFLARE_ENV !== "production" &&
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
