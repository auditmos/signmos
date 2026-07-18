import { agenticSecurityEvents } from "@/db/agentic-access";
import { auditEvents, emailSendRecords, envelopes, fieldValues } from "@/db/envelope";
import { apiHono } from "@/hono/api";
import {
	agentHeaders,
	createSentTwoPartyFixture,
	partnerDeliveryEnv,
	partnerToken,
	resetAgentPartnerFixture,
} from "./agent-partner-test-fixture";
import { selfSignRows as rows } from "./agent-self-sign-test-db";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

describe("agent partner change request", () => {
	beforeEach(resetAgentPartnerFixture);
	afterEach(() => vi.restoreAllMocks());

	it("requires a comment, notifies once, replays exactly, and blocks completion", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId, bucket } = await createSentTwoPartyFixture({
			keyPrefix: "partner-change",
			fetchMock,
		});
		const invalid = await apiHono.request(`/api/v1/documents/${documentId}/change-request`, {
			method: "POST",
			headers: agentHeaders(partnerToken, "partner-change-invalid"),
			body: JSON.stringify({ comment: "" }),
		});
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "INVALID_CHANGE_REQUEST",
				fields: ["comment"],
				recoveryUrl: "/agent.md",
			}),
		});

		const request = () =>
			apiHono.request(
				`/api/v1/documents/${documentId}/change-request`,
				{
					method: "POST",
					headers: agentHeaders(partnerToken, "partner-change-command"),
					body: JSON.stringify({ comment: "Please update the payment terms" }),
				},
				partnerDeliveryEnv,
			);
		const changed = await request();
		expect(changed.status).toBe(200);
		const body = await changed.json();
		expect(body).toEqual({
			data: expect.objectContaining({
				envelopeStatus: "changes_requested",
				allowedActions: expect.arrayContaining(["upload_revised_source_pdf"]),
			}),
		});
		expect(rows(envelopes)[0]?.status).toBe("changes_requested");
		expect(rows(emailSendRecords).filter((row) => row.kind === "change_request")).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const replay = await request();
		expect(replay.status).toBe(200);
		await expect(replay.json()).resolves.toEqual(body);
		expect(rows(emailSendRecords).filter((row) => row.kind === "change_request")).toHaveLength(1);
		expect(
			rows(auditEvents).filter((row) => row.eventType === "partner.change_requested"),
		).toHaveLength(1);
		expect(
			rows(agenticSecurityEvents).filter(
				(row) => row.eventType === "agentic.partner.change_requested",
			),
		).toHaveLength(1);

		const blocked = await apiHono.request(
			`/api/v1/documents/${documentId}/complete`,
			{
				method: "POST",
				headers: agentHeaders(partnerToken, "partner-change-complete"),
				body: JSON.stringify({
					signature: { kind: "typed", typedText: "Ada Partner", typedFont: "cursive" },
					rememberSignature: false,
				}),
			},
			{ ...partnerDeliveryEnv, DOCUMENTS_BUCKET: bucket },
		);
		expect(blocked.status).toBe(409);
		await expect(blocked.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "AGENT_SIGNING_CHANGES_REQUESTED" }),
		});
		expect(rows(fieldValues).filter((row) => row.value === "Ada Partner")).toHaveLength(0);

		const conflict = await apiHono.request(`/api/v1/documents/${documentId}/decline`, {
			method: "POST",
			headers: agentHeaders(partnerToken, "partner-change-command"),
			body: JSON.stringify({ reason: "different intent" }),
		});
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }),
		});
	});
});
