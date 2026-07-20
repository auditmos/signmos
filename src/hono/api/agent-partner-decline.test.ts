import { agenticSecurityEvents } from "@/db/agentic-access";
import { auditEvents, envelopeRecipients, envelopes, fieldValues } from "@/db/envelope";
import { hashHistoryCredential } from "@/db/history-access/request";
import { historySessions } from "@/db/history-access/table";
import { apiHono } from "@/hono/api";
import {
	agentHeaders,
	createSentTwoPartyFixture,
	partnerToken,
	resetAgentPartnerFixture,
} from "./agent-partner-test-fixture";
import { selfSignRows as rows } from "./agent-self-sign-test-db";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

describe("agent partner decline", () => {
	beforeEach(resetAgentPartnerFixture);
	afterEach(() => vi.restoreAllMocks());

	it("queues decline for human review without declining the document", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId, partnerId } = await createSentTwoPartyFixture({
			keyPrefix: "partner-decline-review",
			fetchMock,
		});
		const response = await apiHono.request(`/api/v1/documents/${documentId}/decline`, {
			method: "POST",
			headers: agentHeaders(partnerToken, "partner-decline-review-command"),
			body: JSON.stringify({ reason: "Cannot accept", comment: "Liability is too broad" }),
		});

		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toEqual({
			data: expect.objectContaining({
				commandId: expect.any(String),
				status: "pending_human_review",
				notificationStatus: "fallback",
			}),
		});
		expect(rows(envelopes)[0]?.status).toBe("sent");
		expect(rows(envelopeRecipients).find((row) => row.id === partnerId)?.status).not.toBe(
			"declined",
		);
		expect(rows(auditEvents).filter((row) => row.eventType === "recipient.declined")).toHaveLength(
			0,
		);
		expect(
			rows(agenticSecurityEvents).filter((row) => row.eventType === "agentic.partner.declined"),
		).toHaveLength(0);
		expect(
			rows(agenticSecurityEvents).filter(
				(row) => row.eventType === "agentic.human_review.decline_requested",
			),
		).toHaveLength(1);
	});

	it("requires a reason, preserves an optional comment, replays, and stays terminal", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId, partnerId, bucket } = await createSentTwoPartyFixture({
			keyPrefix: "partner-decline",
			fetchMock,
		});
		const invalid = await apiHono.request(`/api/v1/documents/${documentId}/decline`, {
			method: "POST",
			headers: agentHeaders(partnerToken, "partner-decline-invalid"),
			body: JSON.stringify({ reason: "" }),
		});
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "INVALID_SIGNING_DECLINE",
				fields: ["reason"],
				recoveryUrl: "/agent.md",
			}),
		});

		const decline = () =>
			apiHono.request(`/api/v1/documents/${documentId}/decline`, {
				method: "POST",
				headers: agentHeaders(partnerToken, "partner-decline-command"),
				body: JSON.stringify({
					reason: "Cannot accept",
					comment: "The liability clause is too broad",
				}),
			});
		const declined = await decline();
		expect(declined.status).toBe(202);
		const queued = (await declined.json()) as { data: { reviewUrl: string } };
		const rawSession = "partner-decline-review-session";
		rows(historySessions).push({
			id: "b8000000-0000-4000-8000-000000000001",
			linkId: "b8000000-0000-4000-8000-000000000002",
			email: "partner@example.com",
			sessionHash: await hashHistoryCredential(rawSession),
			status: "active",
			expiresAt: new Date("2026-07-18T10:00:00.000Z"),
			revokedAt: null,
			createdAt: new Date("2026-07-17T10:00:00.000Z"),
		});
		const reviewPath = new URL(queued.data.reviewUrl).pathname.replace(
			"/human-review/",
			"/api/history/human-reviews/",
		);
		const approved = await apiHono.request(`${reviewPath}/decision`, {
			method: "POST",
			headers: {
				cookie: `signmos_history_session=${rawSession}`,
				"content-type": "application/json",
				origin: "http://localhost",
				"x-now": "2026-07-17T10:00:00.000Z",
			},
			body: JSON.stringify({ decision: "approve" }),
		});
		expect(approved.status).toBe(200);
		const body = await approved.json();
		expect(body).toEqual({
			data: expect.objectContaining({
				status: "completed",
				result: expect.objectContaining({
					envelopeId: documentId,
					recipientId: partnerId,
					recipientStatus: "declined",
					envelopeStatus: "declined",
				}),
			}),
		});
		expect(rows(envelopes)[0]?.status).toBe("declined");
		expect(rows(envelopeRecipients).find((row) => row.id === partnerId)?.status).toBe("declined");
		expect(rows(auditEvents)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventType: "recipient.declined", message: "Cannot accept" }),
				expect.objectContaining({
					eventType: "recipient.comment",
					message: "The liability clause is too broad",
				}),
			]),
		);

		const replay = await decline();
		expect(replay.status).toBe(200);
		await expect(replay.json()).resolves.toEqual(body);
		expect(rows(auditEvents).filter((row) => row.eventType === "recipient.declined")).toHaveLength(
			1,
		);
		expect(rows(auditEvents).filter((row) => row.eventType === "recipient.comment")).toHaveLength(
			1,
		);
		expect(
			rows(agenticSecurityEvents).filter((row) => row.eventType === "agentic.partner.declined"),
		).toHaveLength(1);

		const blocked = await apiHono.request(
			`/api/v1/documents/${documentId}/complete`,
			{
				method: "POST",
				headers: agentHeaders(partnerToken, "partner-decline-complete"),
				body: JSON.stringify({
					signature: { kind: "typed", typedText: "Ada Partner", typedFont: "cursive" },
					rememberSignature: false,
				}),
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(blocked.status).toBe(410);
		await expect(blocked.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "AGENT_SIGNING_DECLINED" }),
		});
		expect(rows(fieldValues).filter((row) => row.value === "Ada Partner")).toHaveLength(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
