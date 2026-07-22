import { getCookie, setCookie } from "hono/cookie";
import {
	createAgenticManagementSessionFromVerifiedIdentity,
	resolveAgenticManagementSession,
} from "@/db/agentic-access";
import {
	createHistorySessionFromVerifiedIdentity,
	resolveHistorySessionState,
} from "@/db/history-access";
import { createHono } from "@/hono/factory";
import { getRequestIp } from "./envelope-route-helpers";

type ProductMode = "only_me" | "me_and_another_signer" | "my_documents" | "agentic";
type HistoryMode = Exclude<ProductMode, "agentic">;

interface NavigationContext {
	rawAgenticSession: string | undefined;
	rawHistorySession: string | undefined;
	now: Date;
	requestIp: string;
}

interface NavigationCookie {
	name: "signmos_agentic_management" | "signmos_history_session";
	value: string;
	expiresAt: Date;
	maxAge: number;
}

interface NavigationResult {
	destination: string;
	cookie?: NavigationCookie;
}

const modeNavigationEndpoint = createHono();

modeNavigationEndpoint.get("/:mode", async (c) => {
	const mode = c.req.param("mode");
	if (!isProductMode(mode)) {
		return c.json(
			{ error: { code: "INVALID_PRODUCT_MODE", message: "Choose a supported Signmos option" } },
			400,
		);
	}

	const context: NavigationContext = {
		rawAgenticSession: getCookie(c, "signmos_agentic_management"),
		rawHistorySession: getCookie(c, "signmos_history_session"),
		now: new Date(),
		requestIp: getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
	};
	const result =
		mode === "agentic"
			? await resolveAgenticNavigation(context)
			: await resolveHistoryNavigation(mode, context);

	if (result.cookie) {
		setCookie(c, result.cookie.name, result.cookie.value, {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			expires: result.cookie.expiresAt,
			maxAge: result.cookie.maxAge,
		});
	}

	c.header("Cache-Control", "private, no-store");
	return c.redirect(result.destination, 302);
});

async function resolveAgenticNavigation(context: NavigationContext): Promise<NavigationResult> {
	if (context.rawAgenticSession) {
		const agenticState = await resolveAgenticManagementSession(
			context.rawAgenticSession,
			context.now,
			context.requestIp,
		);
		if (agenticState.state === "active") return { destination: "/agentic-console" };
	}

	if (!context.rawHistorySession) return { destination: "/?task=agentic" };
	const historyState = await resolveHistorySessionState(
		context.rawHistorySession,
		context.now,
		context.requestIp,
	);
	if (historyState.state !== "active") return { destination: "/?task=agentic" };

	const bridge = await createAgenticManagementSessionFromVerifiedIdentity({
		email: historyState.session.email,
		now: context.now,
		requestIp: context.requestIp,
	});
	return {
		destination: "/agentic-console",
		cookie: {
			name: "signmos_agentic_management",
			value: bridge.rawSession,
			expiresAt: bridge.expiresAt,
			maxAge: 15 * 60,
		},
	};
}

async function resolveHistoryNavigation(
	mode: HistoryMode,
	context: NavigationContext,
): Promise<NavigationResult> {
	if (context.rawHistorySession) {
		const historyState = await resolveHistorySessionState(
			context.rawHistorySession,
			context.now,
			context.requestIp,
		);
		if (historyState.state === "active") {
			return { destination: historyDestination(mode, true) };
		}
	}

	if (!context.rawAgenticSession) return { destination: historyDestination(mode, false) };
	const agenticState = await resolveAgenticManagementSession(
		context.rawAgenticSession,
		context.now,
		context.requestIp,
	);
	if (agenticState.state !== "active") {
		return { destination: historyDestination(mode, false) };
	}

	const bridge = await createHistorySessionFromVerifiedIdentity({
		email: agenticState.session.email,
		verifiedUntil: agenticState.session.expiresAt,
		now: context.now,
		requestIp: context.requestIp,
	});
	return {
		destination: historyDestination(mode, true),
		cookie: {
			name: "signmos_history_session",
			value: bridge.rawSession,
			expiresAt: bridge.expiresAt,
			maxAge: Math.max(1, Math.floor((bridge.expiresAt.getTime() - context.now.getTime()) / 1000)),
		},
	};
}

function historyDestination(mode: HistoryMode, active: boolean): string {
	if (mode === "my_documents") return active ? "/my-documents" : "/?task=my-documents";
	if (active) return `/new-document?signingMode=${mode}`;
	return mode === "only_me" ? "/?task=only-me" : "/?task=with-someone";
}

function isProductMode(value: string): value is ProductMode {
	return (
		value === "only_me" ||
		value === "me_and_another_signer" ||
		value === "my_documents" ||
		value === "agentic"
	);
}

export default modeNavigationEndpoint;
