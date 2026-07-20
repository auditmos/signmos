import { agenticSecurityEvents } from "@/db/agentic-access";
import { auditEvents, emailSendRecords, envelopes, sourceDocuments } from "@/db/envelope";
import { hashHistoryCredential } from "@/db/history-access/request";
import { historySessions } from "@/db/history-access/table";
import { apiHono } from "@/hono/api";
import {
	agentHeaders,
	createSentTwoPartyFixture,
	creatorToken,
	resetAgentPartnerFixture,
} from "./agent-partner-test-fixture";
import { selfSignRows as rows, agentSelfSignTestState as state } from "./agent-self-sign-test-db";

export async function expectQueuedCreatorCancel() {
	await resetAgentPartnerFixture();
	const fetchMock = vi.spyOn(globalThis, "fetch");
	const { documentId } = await createSentTwoPartyFixture({
		keyPrefix: "control-cancel-review",
		fetchMock,
	});
	const response = await apiHono.request(`/api/v1/documents/${documentId}/actions`, {
		method: "POST",
		headers: agentHeaders(creatorToken, "control-cancel-review-command"),
		body: JSON.stringify({ action: "cancel" }),
	});

	expect(response.status).toBe(202);
	const pending = (await response.json()) as {
		data: { commandId: string; reviewUrl: string };
	};
	expect(pending).toEqual({
		data: expect.objectContaining({
			commandId: expect.any(String),
			status: "pending_human_review",
			notificationStatus: "fallback",
		}),
	});
	expect(rows(auditEvents).filter((event) => event.eventType === "envelope.canceled")).toHaveLength(
		0,
	);
	expect(rows(emailSendRecords).filter((record) => record.kind === "cancel")).toHaveLength(0);
	expect(
		rows(agenticSecurityEvents).filter((event) => event.eventType === "agentic.document.canceled"),
	).toHaveLength(0);
	expect(
		rows(agenticSecurityEvents).filter(
			(event) => event.eventType === "agentic.human_review.cancel_requested",
		),
	).toHaveLength(1);

	const rawSession = "creator-cancel-review-session";
	rows(historySessions).push({
		id: "b1000000-0000-4000-8000-000000000001",
		linkId: crypto.randomUUID(),
		email: "creator@example.com",
		sessionHash: await hashHistoryCredential(rawSession),
		status: "active",
		expiresAt: new Date(state.now.getTime() + 60 * 60 * 1000),
		revokedAt: null,
		createdAt: state.now,
	});
	const reviewId = new URL(pending.data.reviewUrl).pathname.split("/").at(-1);
	const approved = await apiHono.request(`/api/history/human-reviews/${reviewId}/decision`, {
		method: "POST",
		headers: {
			cookie: `signmos_history_session=${rawSession}`,
			"content-type": "application/json",
			origin: "http://localhost",
			"x-now": state.now.toISOString(),
		},
		body: JSON.stringify({ decision: "approve" }),
	});
	expect(approved.status).toBe(200);
	await expect(approved.json()).resolves.toEqual({
		data: expect.objectContaining({
			commandId: pending.data.commandId,
			status: "completed",
			result: expect.objectContaining({ action: "cancel", status: "expired" }),
		}),
	});
	expect(rows(envelopes).find((envelope) => envelope.id === documentId)?.status).toBe("expired");
	expect(
		rows(agenticSecurityEvents).filter((event) => event.eventType === "agentic.document.canceled"),
	).toHaveLength(1);
}

export async function expectQueuedCreatorExpiration() {
	const fetchMock = vi.spyOn(globalThis, "fetch");
	const { documentId } = await createSentTwoPartyFixture({
		keyPrefix: "control-expire-review",
		fetchMock,
	});
	const response = await apiHono.request(`/api/v1/documents/${documentId}/actions`, {
		method: "POST",
		headers: agentHeaders(creatorToken, "control-expire-review-command"),
		body: JSON.stringify({ action: "expire" }),
	});

	expect(response.status).toBe(202);
	await expect(response.json()).resolves.toEqual({
		data: expect.objectContaining({
			status: "pending_human_review",
			notificationStatus: "fallback",
		}),
	});
	expect(rows(envelopes).find((envelope) => envelope.id === documentId)?.status).toBe("sent");
	expect(rows(auditEvents).filter((event) => event.eventType === "envelope.expired")).toHaveLength(
		0,
	);
	expect(
		rows(agenticSecurityEvents).filter(
			(event) => event.eventType === "agentic.human_review.expire_requested",
		),
	).toHaveLength(1);
}

export async function expectQueuedCreatorDeletion() {
	const fetchMock = vi.spyOn(globalThis, "fetch");
	const { documentId, bucket } = await createSentTwoPartyFixture({
		keyPrefix: "control-delete-review",
		fetchMock,
	});
	const envelope = rows(envelopes).find((candidate) => candidate.id === documentId);
	if (!envelope) throw new Error("delete review fixture envelope missing");
	envelope.status = "expired";
	rows(auditEvents).push({
		id: crypto.randomUUID(),
		envelopeId: documentId,
		recipientId: null,
		eventType: "envelope.expired",
		message: "creator@example.com",
		createdAt: new Date(state.now.getTime() - 90 * 24 * 60 * 60 * 1000),
	});
	const sourceKey = String(rows(sourceDocuments)[0]?.r2Key);
	const response = await apiHono.request(
		`/api/v1/documents/${documentId}/actions`,
		{
			method: "POST",
			headers: agentHeaders(creatorToken, "control-delete-review-command"),
			body: JSON.stringify({ action: "delete" }),
		},
		{ DOCUMENTS_BUCKET: bucket },
	);

	expect(response.status).toBe(202);
	await expect(response.json()).resolves.toEqual({
		data: expect.objectContaining({ status: "pending_human_review" }),
	});
	expect(envelope.status).toBe("expired");
	expect(state.r2Objects.has(sourceKey)).toBe(true);
	expect(state.r2DeleteCounts.get(sourceKey)).toBeUndefined();
	expect(
		rows(agenticSecurityEvents).filter(
			(event) => event.eventType === "agentic.human_review.delete_requested",
		),
	).toHaveLength(1);
}
