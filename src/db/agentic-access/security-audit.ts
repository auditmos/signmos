import { getDb } from "@/db/setup";
import { agenticSecurityEvents } from "./table";

export async function appendAgenticSecurityEvent(input: {
	linkId?: string | null;
	sessionId?: string | null;
	tokenId?: string | null;
	tokenName?: string | null;
	email: string;
	eventType:
		| "agentic.link.issued"
		| "agentic.link.expired"
		| "agentic.link.redeemed"
		| "agentic.session.expired"
		| "agentic.token.created"
		| "agentic.token.revoked"
		| "agentic.identity.read";
	actorType?: "browser" | "agent";
	requestIp?: string | null;
}) {
	await getDb()
		.insert(agenticSecurityEvents)
		.values({
			linkId: input.linkId ?? null,
			sessionId: input.sessionId ?? null,
			tokenId: input.tokenId ?? null,
			tokenName: input.tokenName ?? null,
			email: input.email,
			eventType: input.eventType,
			actorType: input.actorType ?? "browser",
			requestIp: input.requestIp ?? null,
		})
		.returning();
}
