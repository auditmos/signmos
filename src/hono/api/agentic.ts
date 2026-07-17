import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
	generateAgenticToken,
	inspectAgenticAccessLink,
	redeemAgenticAccessLink,
	requestAgenticAccess,
	resolveAgenticManagementSession,
} from "@/db/agentic-access";
import { createHono } from "@/hono/factory";
import { getRequestIp, type SenderStartEnv, verifyTurnstileToken } from "./envelope-route-helpers";

const agenticEndpoint = createHono();

const AgenticAccessRequestSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	turnstileToken: z.string().min(1),
});
const AgenticTokenRequestSchema = z.object({
	name: z.string().trim().min(1).max(100),
	acknowledgeFullAuthority: z.literal(true),
});
const AgenticLinkCredentialSchema = z.object({ credential: z.string().min(1) });

agenticEndpoint.post("/access-links/inspect", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use the Agentic access page" } },
			403,
		);
	}
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = AgenticLinkCredentialSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: { code: "INVALID_AGENTIC_LINK", message: "Agentic link credential required" } },
			400,
		);
	}
	const nowHeader = c.req.header("x-now");
	const inspection = await inspectAgenticAccessLink(
		parsed.data.credential,
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	c.header("Referrer-Policy", "no-referrer");
	return c.json({ data: inspection });
});

agenticEndpoint.post("/access-links/redeem", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use the confirmation page to continue" } },
			403,
		);
	}
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = AgenticLinkCredentialSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: { code: "INVALID_AGENTIC_LINK", message: "Agentic link credential required" } },
			400,
		);
	}
	const nowHeader = c.req.header("x-now");
	const result = await redeemAgenticAccessLink(
		parsed.data.credential,
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (result.status !== "authenticated") {
		const errors = {
			unknown: { status: 404, code: "AGENTIC_LINK_UNKNOWN" },
			consumed: { status: 409, code: "AGENTIC_LINK_CONSUMED" },
			expired: { status: 410, code: "AGENTIC_LINK_EXPIRED" },
		} as const;
		const error = errors[result.status];
		return c.json(
			{ error: { code: error.code, message: "This Agentic access link is not available" } },
			error.status,
		);
	}
	setCookie(c, "signmos_agentic_management", result.rawSession, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		expires: result.expiresAt,
		maxAge: 15 * 60,
	});
	return c.json({ data: { status: result.status, redirectUrl: "/agentic-console" } }, 201);
});

agenticEndpoint.post("/access-requests", async (c) => {
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = AgenticAccessRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_AGENTIC_ACCESS_REQUEST",
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

	const nowHeader = c.req.header("x-now");
	const result = await requestAgenticAccess(parsed.data.email, {
		emailDelivery: { env: c.env, baseUrl: new URL(c.req.url).origin },
		idempotencyKey,
		requestIp,
		now: nowHeader ? new Date(nowHeader) : undefined,
	});
	const exposeDebugLink =
		c.req.header("x-signmos-debug") === "agentic-access-link" &&
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

agenticEndpoint.post("/tokens", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use the Agentic console to continue" } },
			403,
		);
	}
	const nowHeader = c.req.header("x-now");
	const sessionState = await resolveAgenticManagementSession(
		getCookie(c, "signmos_agentic_management") ?? "",
		nowHeader ? new Date(nowHeader) : new Date(),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (sessionState.state !== "active") {
		return c.json(
			{
				error: {
					code:
						sessionState.state === "expired"
							? "AGENTIC_MANAGEMENT_SESSION_EXPIRED"
							: "AGENTIC_MANAGEMENT_SESSION_REQUIRED",
					message: "Verify your email again to manage Agentic tokens",
					recoveryUrl: "/?task=agentic",
				},
			},
			401,
		);
	}
	const body: unknown = await c.req.json().catch(() => null);
	const parsed = AgenticTokenRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_AGENTIC_TOKEN_REQUEST",
					message: "A token name and full-authority acknowledgment are required",
					fields: ["name", "acknowledgeFullAuthority"],
				},
			},
			400,
		);
	}
	const generated = await generateAgenticToken({
		session: sessionState.session,
		name: parsed.data.name,
		requestIp: getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	});
	c.header("Cache-Control", "no-store");
	return c.json({ data: generated }, 201);
});

export default agenticEndpoint;
