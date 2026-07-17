import { getDb } from "@/db/setup";
import { historySecurityEvents } from "./table";

export async function appendHistorySecurityEvent(input: {
	linkId?: string | null;
	sessionId?: string | null;
	email: string;
	eventType: string;
	requestIp?: string | null;
}) {
	await getDb()
		.insert(historySecurityEvents)
		.values({
			linkId: input.linkId ?? null,
			sessionId: input.sessionId ?? null,
			email: input.email,
			eventType: input.eventType,
			requestIp: input.requestIp ?? null,
		})
		.returning();
}
