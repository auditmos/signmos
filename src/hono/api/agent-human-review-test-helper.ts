import { hashHistoryCredential } from "@/db/history-access/request";
import { historySessions } from "@/db/history-access/table";
import { apiHono } from "@/hono/api";
import { selfSignRows as rows, agentSelfSignTestState as state } from "./agent-self-sign-test-db";

export async function approveAgentReview(
	queuedResponse: Response,
	input: { email: string; key: string; env?: Env; now?: Date },
): Promise<Response> {
	if (queuedResponse.status !== 202) {
		throw new Error(`Expected queued human review, received ${queuedResponse.status}`);
	}
	const queued = (await queuedResponse.json()) as { data: { reviewUrl: string } };
	const rawSession = `${input.key}-session`;
	const now = input.now ?? state.now;
	rows(historySessions).push({
		id: crypto.randomUUID(),
		linkId: crypto.randomUUID(),
		email: input.email,
		sessionHash: await hashHistoryCredential(rawSession),
		status: "active",
		expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
		revokedAt: null,
		createdAt: now,
	});
	const reviewPath = new URL(queued.data.reviewUrl).pathname.replace(
		"/human-review/",
		"/api/history/human-reviews/",
	);
	return apiHono.request(
		`${reviewPath}/decision`,
		{
			method: "POST",
			headers: {
				cookie: `signmos_history_session=${rawSession}`,
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": now.toISOString(),
			},
			body: JSON.stringify({ decision: "approve" }),
		},
		input.env,
	);
}
