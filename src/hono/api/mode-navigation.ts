import { getCookie } from "hono/cookie";
import { resolveAgenticManagementSession } from "@/db/agentic-access";
import { resolveHistorySessionState } from "@/db/history-access";
import { createHono } from "@/hono/factory";
import { getRequestIp } from "./envelope-route-helpers";

type ProductMode = "only_me" | "me_and_another_signer" | "my_documents" | "agentic";

const modeNavigationEndpoint = createHono();

modeNavigationEndpoint.get("/:mode", async (c) => {
	const mode = c.req.param("mode");
	if (!isProductMode(mode)) {
		return c.json(
			{ error: { code: "INVALID_PRODUCT_MODE", message: "Choose a supported Signmos option" } },
			400,
		);
	}

	const now = new Date();
	const requestIp = getRequestIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
	let destination: string;

	if (mode === "agentic") {
		const rawSession = getCookie(c, "signmos_agentic_management");
		const active = rawSession
			? (await resolveAgenticManagementSession(rawSession, now, requestIp)).state === "active"
			: false;
		destination = active ? "/agentic-console" : "/?task=agentic";
	} else {
		const rawSession = getCookie(c, "signmos_history_session");
		const active = rawSession
			? (await resolveHistorySessionState(rawSession, now, requestIp)).state === "active"
			: false;
		destination = historyDestination(mode, active);
	}

	c.header("Cache-Control", "private, no-store");
	return c.redirect(destination, 302);
});

function historyDestination(mode: Exclude<ProductMode, "agentic">, active: boolean): string {
	if (mode === "my_documents") return active ? "/my-documents" : "/?task=my-documents";
	if (active) return `/my-documents?start=${mode}`;
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
