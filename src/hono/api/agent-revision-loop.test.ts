import { PDFDocument, StandardFonts } from "pdf-lib";
import { agenticSecurityEvents } from "@/db/agentic-access";
import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";
import {
	agentHeaders,
	createSentTwoPartyFixture,
	creatorToken,
	outsiderToken,
	partnerDeliveryEnv,
	partnerToken,
	resetAgentPartnerFixture,
} from "./agent-partner-test-fixture";
import {
	extractPdfVisibleText,
	selfSignRows as rows,
	agentSelfSignTestState as state,
} from "./agent-self-sign-test-db";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

describe("agent revision loop", () => {
	beforeEach(resetAgentPartnerFixture);
	afterEach(() => vi.restoreAllMocks());

	it("agent command idempotency completes change, revision, replacement, resend, and revised signing", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const { documentId, creatorId, partnerId, bucket } = await createSentTwoPartyFixture({
			keyPrefix: "revision-loop",
			fetchMock,
		});
		const oldProcessToken = String(rows(signerTokens)[0]?.token);
		const staleFieldId = String(rows(envelopeFields)[0]?.id);
		rows(fieldValues).push({
			id: "b1000000-0000-4000-8000-000000000001",
			envelopeId: documentId,
			recipientId: creatorId,
			fieldId: staleFieldId,
			value: "STALE VALUE",
			completedAt: state.now,
		});

		const change = await apiHono.request(
			`/api/v1/documents/${documentId}/change-request`,
			{
				method: "POST",
				headers: agentHeaders(partnerToken, "revision-change"),
				body: JSON.stringify({ comment: "Replace the stale commercial terms" }),
			},
			partnerDeliveryEnv,
		);
		expect(change.status).toBe(200);
		const detail = await apiHono.request(`/api/v1/documents/${documentId}`, {
			headers: agentHeaders(creatorToken),
		});
		expect(detail.status).toBe(200);
		await expect(detail.json()).resolves.toEqual({
			data: expect.objectContaining({
				document: expect.objectContaining({
					status: "changes_requested",
					allowedActions: expect.arrayContaining(["resume"]),
				}),
				history: expect.arrayContaining([
					expect.objectContaining({
						type: "changes_requested",
						detail: "Replace the stale commercial terms",
					}),
				]),
			}),
		});
		const outsiderDetail = await apiHono.request(`/api/v1/documents/${documentId}`, {
			headers: agentHeaders(outsiderToken),
		});
		expect(outsiderDetail.status).toBe(404);

		const revisedBytes = await textPdf("REVISED CONTRACT CONTENT");
		const revise = (token: string, key: string, bytes = revisedBytes) =>
			apiHono.request(
				`/api/v1/documents/${documentId}/source-pdf`,
				{
					method: "PUT",
					headers: {
						...agentHeaders(token, key, "application/pdf"),
						"x-source-filename": "revised-contract.pdf",
					},
					body: arrayBuffer(bytes),
				},
				{ DOCUMENTS_BUCKET: bucket },
			);
		const partnerRevision = await revise(partnerToken, "revision-partner-denied");
		expect(partnerRevision.status).toBe(404);
		const outsiderRevision = await revise(outsiderToken, "revision-outsider-denied");
		expect(outsiderRevision.status).toBe(404);
		const revised = await revise(creatorToken, "revision-upload");
		expect(revised.status).toBe(201);
		const revisedBody = await revised.json();
		expect(revisedBody).toEqual({
			data: expect.objectContaining({
				documentId,
				version: 2,
				byteSize: revisedBytes.byteLength,
				originalFilename: "revised-contract.pdf",
				sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
			}),
		});
		expect(rows(sourceDocuments)).toHaveLength(2);
		expect(rows(sourceDocuments)[1]).toEqual(
			expect.objectContaining({ version: 2, r2Key: `envelopes/${documentId}/source-v2.pdf` }),
		);
		expect(rows(envelopeFields)).toHaveLength(0);
		expect(rows(fieldValues)).toHaveLength(0);
		expect(rows(envelopeRecipients).map((recipient) => recipient.status)).toEqual([
			"pending",
			"pending",
		]);
		expect(rows(signerTokens)[0]?.status).toBe("revoked");
		expect(rows(envelopes)[0]?.status).toBe("draft");

		const revisionReplay = await revise(creatorToken, "revision-upload");
		expect(revisionReplay.status).toBe(201);
		await expect(revisionReplay.json()).resolves.toEqual(revisedBody);
		expect(rows(sourceDocuments)).toHaveLength(2);
		expect(state.r2PutCounts.get(`envelopes/${documentId}/source-v2.pdf`)).toBe(1);
		const revisionConflict = await revise(
			creatorToken,
			"revision-upload",
			await textPdf("DIFFERENT REVISION"),
		);
		expect(revisionConflict.status).toBe(409);
		await expect(revisionConflict.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }),
		});

		const blockedSend = await apiHono.request(
			`/api/v1/documents/${documentId}/send`,
			{
				method: "POST",
				headers: agentHeaders(creatorToken, "revision-send-blocked"),
				body: JSON.stringify({}),
			},
			partnerDeliveryEnv,
		);
		expect(blockedSend.status).toBe(409);
		await expect(blockedSend.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "RECIPIENT_FIELDS_REQUIRED",
				allowedActions: ["place_fields"],
			}),
		});
		for (const [role, token] of [
			["partner", partnerToken],
			["outsider", outsiderToken],
		] as const) {
			const deniedSend = await apiHono.request(
				`/api/v1/documents/${documentId}/send`,
				{
					method: "POST",
					headers: agentHeaders(token, `revision-send-denied-${role}`),
					body: JSON.stringify({}),
				},
				partnerDeliveryEnv,
			);
			expect(deniedSend.status).toBe(404);
		}

		const replaceFields = () =>
			apiHono.request(`/api/v1/documents/${documentId}/fields/defaults`, {
				method: "POST",
				headers: agentHeaders(creatorToken, "revision-fields"),
				body: JSON.stringify({ recipientIds: [creatorId, partnerId], page: 1 }),
			});
		expect((await replaceFields()).status).toBe(201);
		expect((await replaceFields()).status).toBe(201);
		expect(rows(envelopeFields)).toHaveLength(4);

		const creatorComplete = await apiHono.request(`/api/v1/documents/${documentId}/complete`, {
			method: "POST",
			headers: agentHeaders(creatorToken, "revision-creator-complete"),
			body: JSON.stringify({
				signature: { kind: "typed", typedText: "Grace Revised", typedFont: "cursive" },
				rememberSignature: false,
			}),
		});
		expect(creatorComplete.status).toBe(200);
		const resend = () =>
			apiHono.request(
				`/api/v1/documents/${documentId}/send`,
				{
					method: "POST",
					headers: agentHeaders(creatorToken, "revision-resend"),
					body: JSON.stringify({}),
				},
				partnerDeliveryEnv,
			);
		expect((await resend()).status).toBe(200);
		expect((await resend()).status).toBe(200);
		expect(rows(envelopeRecipients)).toHaveLength(2);
		expect(rows(signerTokens).filter((token) => token.status === "active")).toHaveLength(1);
		expect(
			rows(emailSendRecords).filter((record) => record.kind === "partner_verification"),
		).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledTimes(3);

		const staleProcess = await apiHono.request(`/api/signing/${oldProcessToken}`);
		expect(staleProcess.status).toBe(404);
		const staleVerification = await apiHono.request(
			`/api/signing/verifications/${oldProcessToken}`,
		);
		expect(staleVerification.status).toBe(404);

		const task = await apiHono.request(`/api/v1/documents/${documentId}/signing-task`, {
			headers: agentHeaders(partnerToken),
		});
		expect(task.status).toBe(200);
		await expect(task.json()).resolves.toEqual({
			data: expect.objectContaining({
				sourceDocument: expect.objectContaining({ version: 2 }),
				fields: expect.arrayContaining([
					expect.objectContaining({ type: "signature" }),
					expect.objectContaining({ type: "date" }),
				]),
			}),
		});
		const completed = await apiHono.request(
			`/api/v1/documents/${documentId}/complete`,
			{
				method: "POST",
				headers: agentHeaders(partnerToken, "revision-partner-complete"),
				body: JSON.stringify({
					signature: { kind: "typed", typedText: "Ada Revised", typedFont: "cursive" },
					rememberSignature: false,
				}),
			},
			{ ...partnerDeliveryEnv, DOCUMENTS_BUCKET: bucket },
		);
		expect(completed.status).toBe(200);
		expect(rows(finalDocuments)).toHaveLength(1);
		const finalKey = String(rows(finalDocuments)[0]?.r2Key);
		const finalText = extractPdfVisibleText(state.r2Objects.get(finalKey) ?? new Uint8Array());
		expect(finalText).toContain("REVISED CONTRACT CONTENT");
		expect(finalText).toContain("Grace Revised");
		expect(finalText).toContain("Ada Revised");
		expect(finalText).not.toContain("STALE VALUE");
		for (const eventType of ["agentic.source_pdf.revised", "agentic.document.sent"]) {
			expect(rows(agenticSecurityEvents)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						eventType,
						documentId,
						email: "creator@example.com",
						tokenId: "a1000000-0000-4000-8000-000000000001",
						tokenName: "Creator personal token",
					}),
				]),
			);
		}
		expect(JSON.stringify(rows(agenticSecurityEvents))).not.toContain(oldProcessToken);
		expect(JSON.stringify(rows(agenticSecurityEvents))).not.toContain(partnerToken);
		expect(
			rows(auditEvents).filter((event) => event.eventType === "source_pdf.revised"),
		).toHaveLength(1);
	});
});

async function textPdf(text: string): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	page.drawText(text, { x: 72, y: 720, font, size: 16 });
	return pdf.save({ useObjectStreams: false });
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}
