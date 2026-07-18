import { agenticSecurityEvents } from "@/db/agentic-access";
import { auditEvents, envelopeRecipients, envelopes, fieldValues } from "@/db/envelope";
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
		expect(declined.status).toBe(200);
		const body = await declined.json();
		expect(body).toEqual({
			data: expect.objectContaining({
				envelopeId: documentId,
				recipientId: partnerId,
				recipientStatus: "declined",
				envelopeStatus: "declined",
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
