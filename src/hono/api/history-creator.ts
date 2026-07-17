import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { controlEnvelope, EnvelopeControlError } from "@/db/envelope";
import {
	authorizeHistoryCreator,
	recordHistoryCreatorAudit,
	resolveHistorySessionState,
	type VerifiedHistorySession,
} from "@/db/history-access";
import { createHono } from "@/hono/factory";
import { getRequestIp } from "./envelope-route-helpers";

const historyCreatorEndpoint = createHono();
const HistoryCreatorActionSchema = z.object({ action: z.enum(["cancel", "delete"]) });

historyCreatorEndpoint.get("/documents/:envelopeId/creator", async (c) => {
	const context = await requireHistoryCreator(c);
	if (context instanceof Response) return context;
	await recordHistoryCreatorAudit({
		envelopeId: context.access.envelopeId,
		eventType: "history.creator.opened",
	});
	return c.json({ data: context.access });
});

historyCreatorEndpoint.post("/documents/:envelopeId/creator-actions", async (c) => {
	if (c.req.header("origin") !== new URL(c.req.url).origin) {
		return c.json(
			{ error: { code: "INVALID_ORIGIN", message: "Use My documents to control this document" } },
			403,
		);
	}
	const parsed = HistoryCreatorActionSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) {
		return c.json(
			{ error: { code: "INVALID_HISTORY_CREATOR_ACTION", message: "Use cancel or delete" } },
			400,
		);
	}
	const context = await requireHistoryCreator(c);
	if (context instanceof Response) return context;
	if (!context.access.allowedActions.includes(parsed.data.action)) {
		return c.json(
			{
				error: {
					code: "HISTORY_CREATOR_ACTION_BLOCKED",
					message: "This creator action is not allowed in the current state",
					allowedActions: context.access.allowedActions,
				},
			},
			409,
		);
	}
	try {
		const result = await controlEnvelope(
			context.access.envelopeId,
			context.session.email,
			parsed.data.action,
			{
				documentsBucket: (c.env as (Env & { DOCUMENTS_BUCKET?: R2Bucket }) | undefined)
					?.DOCUMENTS_BUCKET,
			},
		);
		await recordHistoryCreatorAudit({
			envelopeId: context.access.envelopeId,
			eventType:
				parsed.data.action === "cancel" ? "history.creator.canceled" : "history.creator.deleted",
		});
		return c.json({ data: result });
	} catch (error) {
		if (error instanceof EnvelopeControlError) {
			return c.json(
				{
					error: {
						code: "HISTORY_CREATOR_ACTION_BLOCKED",
						message: "This creator action is not allowed in the current state",
						allowedActions: error.allowedActions,
					},
				},
				409,
			);
		}
		throw error;
	}
});

async function requireHistoryCreator(c: Context<{ Bindings: Env }>) {
	const session = await requireHistorySession(c);
	if (session instanceof Response) return session;
	const envelopeId = c.req.param("envelopeId");
	if (!envelopeId) return creatorError("forbidden");
	const authorization = await authorizeHistoryCreator(session.email, envelopeId, requestNow(c));
	if (authorization.state !== "active") return creatorError(authorization.state);
	return { session, access: authorization.access };
}

async function requireHistorySession(
	c: Context<{ Bindings: Env }>,
): Promise<VerifiedHistorySession | Response> {
	const state = await resolveHistorySessionState(
		getCookie(c, "signmos_history_session") ?? "",
		requestNow(c),
		getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	);
	if (state.state === "active") return state.session;
	const expired = state.state === "expired";
	return Response.json(
		{
			error: {
				code: expired ? "HISTORY_SESSION_EXPIRED" : "HISTORY_SESSION_REQUIRED",
				message: expired ? "Your My documents session expired" : "Request a new My documents link",
				recoveryUrl: "/?task=my-documents",
			},
		},
		{ status: 401 },
	);
}

function creatorError(state: "deleted" | "forbidden"): Response {
	return state === "deleted"
		? Response.json(
				{ error: { code: "HISTORY_CREATOR_DELETED", message: "This document was deleted" } },
				{ status: 410 },
			)
		: Response.json(
				{
					error: {
						code: "HISTORY_CREATOR_FORBIDDEN",
						message: "Only the document creator can use this action",
					},
				},
				{ status: 403 },
			);
}

function requestNow(c: Context<{ Bindings: Env }>): Date {
	return new Date(c.req.header("x-now") ?? Date.now());
}

export default historyCreatorEndpoint;
