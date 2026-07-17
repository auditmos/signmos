import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import {
	HistoryEnvelopeStartRequestSchema,
	resolveHistorySessionState,
	startHistoryEnvelope,
} from "@/db/history-access";
import { createHono } from "@/hono/factory";
import { getRequestIp } from "./envelope-route-helpers";
import { historyError } from "./history-errors";

const historyEnvelopeStartEndpoint = createHono();

historyEnvelopeStartEndpoint.post("/envelopes", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use My documents to start a document" } },
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
	const parsed = HistoryEnvelopeStartRequestSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_HISTORY_ENVELOPE_START",
					message: "Name and signing mode are required",
					fields: ["name", "signingMode"],
				},
			},
			400,
		);
	}
	const session = await requireHistorySession(c);
	if (session instanceof Response) return session;
	const result = await startHistoryEnvelope({
		session,
		request: parsed.data,
		idempotencyKey,
		requestIp: requestIp(c),
	});
	const { reused, ...data } = result;
	return c.json({ data }, reused ? 200 : 201);
});

async function requireHistorySession(c: Context<{ Bindings: Env }>) {
	const state = await resolveHistorySessionState(
		getCookie(c, "signmos_history_session") ?? "",
		new Date(c.req.header("x-now") ?? Date.now()),
		requestIp(c),
	);
	if (state.state === "active") return state.session;
	return Response.json(
		historyError(
			state.state === "expired" ? "HISTORY_SESSION_EXPIRED" : "HISTORY_SESSION_REQUIRED",
		),
		{ status: 401 },
	);
}

function requestIp(c: Context<{ Bindings: Env }>): string {
	return getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
}

export default historyEnvelopeStartEndpoint;
