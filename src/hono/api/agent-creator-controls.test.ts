import { agenticSecurityEvents } from "@/db/agentic-access";
import { agenticCommandRecords } from "@/db/agentic-access/table";
import {
	auditEvents,
	emailSendRecords,
	finalDocuments,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { hashHistoryCredential } from "@/db/history-access/request";
import { historySessions } from "@/db/history-access/table";
import { apiHono } from "@/hono/api";
import {
	expectQueuedCreatorCancel,
	expectQueuedCreatorDeletion,
	expectQueuedCreatorExpiration,
} from "./agent-creator-review-test-assertions";
import {
	agentHeaders,
	createSentTwoPartyFixture,
	creatorToken,
	outsiderToken,
	partnerDeliveryEnv,
	partnerToken,
	resetAgentPartnerFixture,
} from "./agent-partner-test-fixture";
import { selfSignRows as rows, agentSelfSignTestState as state } from "./agent-self-sign-test-db";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

async function approveQueuedReview(
	queuedResponse: Response,
	input: { email: string; key: string; env?: Env; now?: Date },
): Promise<Response> {
	expect(queuedResponse.status).toBe(202);
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

describe("agent creator controls", () => {
	beforeEach(resetAgentPartnerFixture);
	afterEach(() => vi.restoreAllMocks());

	it("queues creator cancel for human review without canceling the document", async () => {
		await expectQueuedCreatorCancel();
	});

	it("queues creator expiration for human review without expiring the document", async () => {
		await expectQueuedCreatorExpiration();
	});

	it("queues eligible creator deletion for human review without deleting artifacts", async () => {
		await expectQueuedCreatorDeletion();
	});

	it("agent command idempotency enforces creator-only cancel/expire and exact retention boundary", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId } = await createSentTwoPartyFixture({
			keyPrefix: "control-cancel",
			fetchMock,
		});
		const action = (token: string, key: string, value: "cancel" | "expire" | "delete") =>
			apiHono.request(`/api/v1/documents/${documentId}/actions`, {
				method: "POST",
				headers: agentHeaders(token, key),
				body: JSON.stringify({ action: value }),
			});
		const retention = (token: string, now: Date) =>
			apiHono.request(`/api/v1/documents/${documentId}/retention`, {
				headers: {
					...agentHeaders(token),
					"x-now": now.toISOString(),
				},
			});
		const missingKey = await apiHono.request(`/api/v1/documents/${documentId}/actions`, {
			method: "POST",
			headers: agentHeaders(creatorToken),
			body: JSON.stringify({ action: "cancel" }),
		});
		expect(missingKey.status).toBe(400);
		await expect(missingKey.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "IDEMPOTENCY_KEY_REQUIRED" }),
		});
		const activeRetention = await retention(creatorToken, state.now);
		expect(activeRetention.status).toBe(200);
		await expect(activeRetention.json()).resolves.toEqual({
			data: expect.objectContaining({
				status: "sent",
				retentionEligibleAt: null,
				retentionEligible: false,
			}),
		});
		for (const token of [partnerToken, outsiderToken]) {
			const denied = await action(token, `control-denied-${token}`, "cancel");
			expect(denied.status).toBe(404);
		}
		const canceled = await approveQueuedReview(
			await action(creatorToken, "control-cancel-command", "cancel"),
			{ email: "creator@example.com", key: "control-cancel-approval" },
		);
		expect(canceled.status).toBe(200);
		const canceledBody = await canceled.json();
		expect(canceledBody).toEqual({
			data: expect.objectContaining({
				status: "completed",
				result: {
					envelopeId: documentId,
					action: "cancel",
					status: "expired",
					allowedActions: ["delete"],
				},
			}),
		});
		expect((await action(creatorToken, "control-cancel-command", "cancel")).status).toBe(200);
		expect(
			rows(auditEvents).filter((event) => event.eventType === "envelope.canceled"),
		).toHaveLength(1);
		expect(rows(emailSendRecords).filter((record) => record.kind === "cancel")).toHaveLength(1);
		const conflict = await action(creatorToken, "control-cancel-command", "delete");
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }),
		});

		const retained = await apiHono.request("/api/v1/documents", {
			headers: agentHeaders(partnerToken),
		});
		expect(JSON.stringify(await retained.json())).toContain(documentId);
		const processToken = String(rows(signerTokens)[0]?.token);
		expect((await apiHono.request(`/api/signing/${processToken}`)).status).toBe(410);
		expect(
			(
				await apiHono.request(`/api/v1/documents/${documentId}/signing-task`, {
					headers: agentHeaders(partnerToken),
				})
			).status,
		).toBe(410);

		const boundary = new Date(state.now.getTime() + 90 * 24 * 60 * 60 * 1000);
		const before = await retention(creatorToken, new Date(boundary.getTime() - 1));
		expect(before.status).toBe(200);
		await expect(before.json()).resolves.toEqual({
			data: expect.objectContaining({
				status: "expired",
				retentionEligibleAt: boundary.toISOString(),
				retentionEligible: false,
			}),
		});
		const exact = await retention(creatorToken, boundary);
		expect(exact.status).toBe(200);
		await expect(exact.json()).resolves.toEqual({
			data: expect.objectContaining({ retentionEligible: true }),
		});
		expect((await retention(partnerToken, boundary)).status).toBe(404);
		expect((await retention(outsiderToken, boundary)).status).toBe(404);
		expect(rows(agenticSecurityEvents)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					eventType: "agentic.document.canceled",
					email: "creator@example.com",
					tokenId: "a1000000-0000-4000-8000-000000000001",
					tokenName: "Creator personal token",
				}),
				expect.objectContaining({ eventType: "agentic.retention.read" }),
			]),
		);

		await resetAgentPartnerFixture();
		const second = await createSentTwoPartyFixture({
			keyPrefix: "control-expire",
			fetchMock,
		});
		const changeRequested = await apiHono.request(
			`/api/v1/documents/${second.documentId}/change-request`,
			{
				method: "POST",
				headers: agentHeaders(partnerToken, "control-expire-change"),
				body: JSON.stringify({ comment: "Please revise before expiration" }),
			},
			partnerDeliveryEnv,
		);
		expect(changeRequested.status).toBe(200);
		const expired = await approveQueuedReview(
			await apiHono.request(`/api/v1/documents/${second.documentId}/actions`, {
				method: "POST",
				headers: agentHeaders(creatorToken, "control-expire-command"),
				body: JSON.stringify({ action: "expire" }),
			}),
			{ email: "creator@example.com", key: "control-expire-approval" },
		);
		expect(expired.status).toBe(200);
		await expect(expired.json()).resolves.toEqual({
			data: expect.objectContaining({
				status: "completed",
				result: expect.objectContaining({ action: "expire", status: "expired" }),
			}),
		});

		const draft = await apiHono.request("/api/v1/documents", {
			method: "POST",
			headers: agentHeaders(creatorToken, "control-draft-create"),
			body: JSON.stringify({ name: "Blocked Draft", signingMode: "only_me" }),
		});
		const draftId = ((await draft.json()) as { data: { documentId: string } }).data.documentId;
		const blocked = await apiHono.request(`/api/v1/documents/${draftId}/actions`, {
			method: "POST",
			headers: agentHeaders(creatorToken, "control-draft-cancel"),
			body: JSON.stringify({ action: "cancel" }),
		});
		expect(blocked.status).toBe(409);
		await expect(blocked.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "ENVELOPE_ACTION_BLOCKED",
				allowedActions: expect.arrayContaining(["upload_source_pdf"]),
			}),
		});
	});

	it("deletes artifacts once and revokes bearer, process-link, and history-session paths", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId, bucket } = await createSentTwoPartyFixture({
			keyPrefix: "control-delete",
			fetchMock,
		});
		const processToken = String(rows(signerTokens)[0]?.token);
		const completed = await approveQueuedReview(
			await apiHono.request(
				`/api/v1/documents/${documentId}/complete`,
				{
					method: "POST",
					headers: agentHeaders(partnerToken, "control-delete-complete"),
					body: JSON.stringify({
						signature: { kind: "typed", typedText: "Ada Partner", typedFont: "cursive" },
						rememberSignature: false,
					}),
				},
				{ ...partnerDeliveryEnv, DOCUMENTS_BUCKET: bucket },
			),
			{
				email: "partner@example.com",
				key: "control-delete-complete-approval",
				env: { ...partnerDeliveryEnv, DOCUMENTS_BUCKET: bucket } as Env,
			},
		);
		expect(completed.status).toBe(200);
		const completedBoundary = new Date(state.now.getTime() + 90 * 24 * 60 * 60 * 1000);
		const completedRetention = await apiHono.request(`/api/v1/documents/${documentId}/retention`, {
			headers: {
				...agentHeaders(creatorToken),
				"x-now": completedBoundary.toISOString(),
			},
		});
		expect(completedRetention.status).toBe(200);
		await expect(completedRetention.json()).resolves.toEqual({
			data: expect.objectContaining({
				status: "completed",
				retentionEligibleAt: completedBoundary.toISOString(),
				retentionEligible: true,
			}),
		});
		const sourceKey = String(rows(sourceDocuments)[0]?.r2Key);
		const finalKey = String(rows(finalDocuments)[0]?.r2Key);
		const rawHistorySession = "history-session-for-delete-proof";
		rows(historySessions).push({
			id: "c1000000-0000-4000-8000-000000000001",
			linkId: "c2000000-0000-4000-8000-000000000001",
			email: "partner@example.com",
			sessionHash: await hashHistoryCredential(rawHistorySession),
			status: "active",
			expiresAt: new Date("2026-07-18T12:34:56.000Z"),
			revokedAt: null,
			createdAt: state.now,
		});
		const historyHeaders = {
			cookie: `signmos_history_session=${rawHistorySession}`,
			"x-now": state.now.toISOString(),
		};
		expect(
			(await apiHono.request("/api/history/documents", { headers: historyHeaders })).status,
		).toBe(200);

		const remove = () =>
			apiHono.request(
				`/api/v1/documents/${documentId}/actions`,
				{
					method: "POST",
					headers: {
						...agentHeaders(creatorToken, "control-delete-command"),
						"x-now": completedBoundary.toISOString(),
					},
					body: JSON.stringify({ action: "delete" }),
				},
				{ DOCUMENTS_BUCKET: bucket },
			);
		const queuedDelete = await remove();
		const queuedDeleteBody = (await queuedDelete.clone().json()) as {
			data: { reviewUrl: string };
		};
		const deleted = await approveQueuedReview(queuedDelete, {
			email: "creator@example.com",
			key: "control-delete-approval",
			env: { DOCUMENTS_BUCKET: bucket } as Env,
			now: completedBoundary,
		});
		expect(deleted.status).toBe(200);
		const deletedBody = await deleted.json();
		expect(deletedBody).toEqual({
			data: expect.objectContaining({
				status: "completed",
				result: { envelopeId: documentId, action: "delete", status: "deleted", allowedActions: [] },
			}),
		});
		expect((await remove()).status).toBe(200);
		expect(state.r2DeleteCounts.get(sourceKey)).toBe(1);
		expect(state.r2DeleteCounts.get(finalKey)).toBe(1);
		expect(state.r2Objects.has(sourceKey)).toBe(false);
		expect(state.r2Objects.has(finalKey)).toBe(false);
		expect(
			rows(auditEvents).filter((event) => event.eventType === "envelope.deleted"),
		).toHaveLength(1);
		expect(
			rows(agenticSecurityEvents).filter((event) => event.eventType === "agentic.document.deleted"),
		).toHaveLength(1);
		expect(
			rows(agenticCommandRecords).filter(
				(record) => record.idempotencyKey === "control-delete-command",
			),
		).toHaveLength(1);
		const reviewPath = new URL(queuedDeleteBody.data.reviewUrl).pathname.replace(
			"/human-review/",
			"/api/history/human-reviews/",
		);
		const revisitedReview = await apiHono.request(reviewPath, {
			headers: {
				cookie: "signmos_history_session=control-delete-approval-session",
				"x-now": completedBoundary.toISOString(),
			},
		});
		expect(revisitedReview.status).toBe(200);
		await expect(revisitedReview.json()).resolves.toEqual({
			data: expect.objectContaining({
				status: "completed",
				document: expect.objectContaining({
					documentId,
					title: "document.pdf",
					sourcePdfUrl: null,
				}),
			}),
		});

		for (const token of [creatorToken, partnerToken]) {
			const catalog = await apiHono.request("/api/v1/documents", {
				headers: agentHeaders(token),
			});
			expect(JSON.stringify(await catalog.json())).not.toContain(documentId);
			const detail = await apiHono.request(`/api/v1/documents/${documentId}`, {
				headers: agentHeaders(token),
			});
			expect(detail.status).toBe(404);
			const pdf = await apiHono.request(
				`/api/v1/documents/${documentId}/pdf`,
				{
					headers: agentHeaders(token),
				},
				{ DOCUMENTS_BUCKET: bucket },
			);
			expect(pdf.status).toBe(404);
		}
		const process = await apiHono.request(`/api/signing/${processToken}`);
		expect(process.status).toBe(410);
		await expect(process.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "ENVELOPE_DELETED" }),
		});
		const processFinal = await apiHono.request(
			`/api/signing/${processToken}/final-pdf`,
			undefined,
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(processFinal.status).toBe(410);
		const historyCatalog = await apiHono.request("/api/history/documents", {
			headers: historyHeaders,
		});
		expect(historyCatalog.status).toBe(200);
		expect(JSON.stringify(await historyCatalog.json())).not.toContain(documentId);
		const historyDetail = await apiHono.request(`/api/history/documents/${documentId}`, {
			headers: historyHeaders,
		});
		expect(historyDetail.status).toBe(404);
		const historyPdf = await apiHono.request(
			`/api/history/documents/${documentId}/pdf`,
			{ headers: historyHeaders },
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(historyPdf.status).toBe(404);
		const freshAction = await apiHono.request(`/api/v1/documents/${documentId}/actions`, {
			method: "POST",
			headers: agentHeaders(creatorToken, "control-delete-fresh"),
			body: JSON.stringify({ action: "delete" }),
		});
		expect(freshAction.status).toBe(404);
	});
});
