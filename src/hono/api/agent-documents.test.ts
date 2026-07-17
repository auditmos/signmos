import { agenticApiTokens, agenticSecurityEvents } from "@/db/agentic-access";
import { hashAgenticCredential } from "@/db/agentic-access/request";
import {
	auditEvents,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	senderVerificationTokens,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";
import { rows, agentDocumentsTestState as state } from "./agent-documents-test-db";

const ownerToken = "signmos_owner_document_token";
const outsiderToken = "signmos_outsider_document_token";
const creatorDocumentId = "00000000-0000-4000-8000-000000000001";
const signerDocumentId = "00000000-0000-4000-8000-000000000002";
const completedDocumentId = "00000000-0000-4000-8000-000000000003";
const unrelatedDocumentId = "00000000-0000-4000-8000-000000000004";
const deletedDocumentId = "00000000-0000-4000-8000-000000000005";
const finalDocumentId = "90000000-0000-4000-8000-000000000003";
const finalR2Key = `envelopes/${completedDocumentId}/final.pdf`;

vi.mock("@/db/setup", async () => {
	const { getAgentDocumentsTestDb } = await import("./agent-documents-test-db");
	return { getDb: getAgentDocumentsTestDb };
});

function addEnvelope(input: { id: string; status: string; creator: string; createdAt: string }) {
	rows(envelopes).push({
		id: input.id,
		status: input.status,
		signingMode: "me_and_another_signer",
		createdBy: input.creator,
		createdByName: input.creator.split("@")[0],
		createdAt: new Date(input.createdAt),
		sentBy: input.status === "draft" ? null : input.creator,
		sentAt: input.status === "draft" ? null : new Date(input.createdAt),
	});
}

function addRecipient(input: { id: string; documentId: string; email: string; status: string }) {
	rows(envelopeRecipients).push({
		id: input.id,
		envelopeId: input.documentId,
		name: input.email.split("@")[0],
		email: input.email,
		status: input.status,
		createdAt: new Date("2026-07-16T08:00:00.000Z"),
	});
}

function addSource(documentId: string, sequence: number, title: string) {
	rows(sourceDocuments).push({
		id: `60000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
		envelopeId: documentId,
		r2Key: `envelopes/${documentId}/source.pdf`,
		version: 1,
		sha256: "a".repeat(64),
		byteSize: 100,
		contentType: "application/pdf",
		originalFilename: title,
		uploadedBy: "owner@example.com",
		uploadedAt: new Date("2026-07-16T08:00:00.000Z"),
	});
}

function auth(token = ownerToken) {
	return { authorization: `Bearer ${token}`, "x-now": "2026-07-17T10:00:00.000Z" };
}

function documentsBucket() {
	return {
		get: async (key: string) => {
			const bytes = state.r2Objects.get(key);
			return bytes ? { arrayBuffer: async () => bytes.buffer } : null;
		},
	};
}

describe("agent read-only documents", () => {
	beforeEach(async () => {
		state.rows = new Map(
			[
				agenticApiTokens,
				agenticSecurityEvents,
				envelopes,
				envelopeRecipients,
				sourceDocuments,
				senderVerificationTokens,
				auditEvents,
				finalDocuments,
				envelopeFields,
				fieldValues,
				signerTokens,
			].map((table) => [table, []]),
		);
		rows(agenticApiTokens).push(
			{
				id: "30000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				name: "Owner agent",
				tokenHash: await hashAgenticCredential(ownerToken),
				tokenHint: "signmos_…oken",
				status: "active",
				lastUsedAt: null,
				createdAt: new Date("2026-07-17T08:00:00.000Z"),
			},
			{
				id: "30000000-0000-4000-8000-000000000002",
				email: "outsider@example.com",
				name: "Outsider agent",
				tokenHash: await hashAgenticCredential(outsiderToken),
				tokenHint: "signmos_…sder",
				status: "active",
				lastUsedAt: null,
				createdAt: new Date("2026-07-17T08:00:00.000Z"),
			},
		);
		addEnvelope({
			id: creatorDocumentId,
			status: "sent",
			creator: "OWNER@Example.COM",
			createdAt: "2026-07-16T08:00:00.000Z",
		});
		addRecipient({
			id: "20000000-0000-4000-8000-000000000001",
			documentId: creatorDocumentId,
			email: "partner@example.com",
			status: "sent",
		});
		addEnvelope({
			id: signerDocumentId,
			status: "sent",
			creator: "other@example.com",
			createdAt: "2026-07-16T09:00:00.000Z",
		});
		addRecipient({
			id: "20000000-0000-4000-8000-000000000002",
			documentId: signerDocumentId,
			email: "Owner@Example.com",
			status: "sent",
		});
		addEnvelope({
			id: completedDocumentId,
			status: "completed",
			creator: "owner@example.com",
			createdAt: "2026-07-16T10:00:00.000Z",
		});
		addRecipient({
			id: "20000000-0000-4000-8000-000000000003",
			documentId: completedDocumentId,
			email: "OWNER@example.com",
			status: "completed",
		});
		addEnvelope({
			id: unrelatedDocumentId,
			status: "completed",
			creator: "unrelated@example.com",
			createdAt: "2026-07-16T11:00:00.000Z",
		});
		addEnvelope({
			id: deletedDocumentId,
			status: "deleted",
			creator: "owner@example.com",
			createdAt: "2026-07-16T12:00:00.000Z",
		});
		addSource(creatorDocumentId, 1, "Creator Contract.pdf");
		addSource(signerDocumentId, 2, "Signer Contract.pdf");
		addSource(completedDocumentId, 3, "Completed Contract.pdf");
		addSource(unrelatedDocumentId, 4, "Unrelated Secret.pdf");
		addSource(deletedDocumentId, 5, "Deleted Contract.pdf");
		rows(senderVerificationTokens).push({
			id: "10000000-0000-4000-8000-000000000001",
			envelopeId: completedDocumentId,
			name: "Owner",
			email: "owner@example.com",
			token: "process-token-must-not-leak",
			status: "verified",
			expiresAt: new Date("2026-07-17T12:00:00.000Z"),
			verifiedAt: new Date("2026-07-16T10:00:00.000Z"),
			createdAt: new Date("2026-07-16T10:00:00.000Z"),
		});
		const finalPdf = new TextEncoder().encode("%PDF-1.4\nagent authorized artifact\n%%EOF");
		rows(finalDocuments).push({
			id: finalDocumentId,
			envelopeId: completedDocumentId,
			r2Key: finalR2Key,
			sha256: "b".repeat(64),
			byteSize: finalPdf.byteLength,
			contentType: "application/pdf",
			createdAt: new Date("2026-07-16T11:00:00.000Z"),
		});
		rows(auditEvents).push(
			{
				id: "70000000-0000-4000-8000-000000000001",
				envelopeId: completedDocumentId,
				recipientId: null,
				eventType: "source_pdf.uploaded",
				message: "Completed Contract.pdf",
				createdAt: new Date("2026-07-16T10:00:00.000Z"),
			},
			{
				id: "70000000-0000-4000-8000-000000000002",
				envelopeId: completedDocumentId,
				recipientId: null,
				eventType: "sender.verification.sent",
				message: "internal-event-must-not-leak",
				createdAt: new Date("2026-07-16T10:01:00.000Z"),
			},
		);
		state.r2Objects = new Map([[finalR2Key, finalPdf]]);
	});

	it("projects normalized catalog filters, role matrix, ordering, and isolation", async () => {
		// Issue #46 catalog assumptions before RED:
		// - The My Documents projection remains the authorization and ordering source of truth.
		// - Public URLs are Agent API URLs; process credentials and unrelated rows never project.
		const missing = await apiHono.request("/api/v1/documents");
		expect(missing.status).toBe(401);

		const response = await apiHono.request(
			"/api/v1/documents?search=Signer&role=signer&group=needs_my_action&status=sent&page=1",
			{ headers: auth() },
		);
		expect(response.status).toBe(200);
		const filtered = await response.json();
		expect(filtered).toEqual({
			data: {
				identity: { email: "owner@example.com" },
				documents: [
					expect.objectContaining({
						documentId: signerDocumentId,
						role: "signer",
						group: "needs_my_action",
						allowedActions: ["sign"],
					}),
				],
				pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
			},
		});

		const catalog = await apiHono.request("/api/v1/documents", { headers: auth() });
		const body = (await catalog.json()) as {
			data: {
				documents: Array<{ documentId: string; role: string; urls: Record<string, unknown> }>;
			};
		};
		expect(body.data.documents.map((document) => [document.documentId, document.role])).toEqual([
			[signerDocumentId, "signer"],
			[completedDocumentId, "creator_and_signer"],
			[creatorDocumentId, "creator"],
		]);
		expect(body.data.documents[0]?.urls).toEqual({
			detail: `/api/v1/documents/${signerDocumentId}`,
			status: `/api/v1/documents/${signerDocumentId}/status`,
			history: `/api/v1/documents/${signerDocumentId}/history`,
			finalPdf: null,
		});
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/process-token|tokenHash|senderSession|Unrelated|Deleted/);
		const listedEvents = rows(agenticSecurityEvents).filter(
			(event) => event.eventType === "agentic.document.listed",
		);
		expect(listedEvents.length).toBeGreaterThanOrEqual(4);
		for (const event of listedEvents) {
			expect(event).toEqual(
				expect.objectContaining({
					email: "owner@example.com",
					tokenId: "30000000-0000-4000-8000-000000000001",
					tokenName: "Owner agent",
					documentId: expect.stringMatching(/^[0-9a-f-]{36}$/),
					actorType: "agent",
				}),
			);
		}

		const outsider = await apiHono.request(`/api/v1/documents/${completedDocumentId}`, {
			headers: auth(outsiderToken),
		});
		expect(outsider.status).toBe(404);
		await expect(outsider.json()).resolves.toEqual({
			error: {
				code: "AGENT_DOCUMENT_NOT_FOUND",
				message: "Document not found",
				retryable: false,
				allowedActions: ["list_documents"],
				recoveryUrl: "/api/v1/documents",
			},
		});
		const guessed = await apiHono.request(
			"/api/v1/documents/00000000-0000-4000-8000-000000000099",
			{ headers: auth() },
		);
		expect(guessed.status).toBe(404);
		const invalidQuery = await apiHono.request("/api/v1/documents?page=0", { headers: auth() });
		expect(invalidQuery.status).toBe(400);
		expect(await invalidQuery.json()).toEqual({
			error: expect.objectContaining({
				code: "AGENT_INVALID_DOCUMENT_QUERY",
				retryable: false,
				recoveryUrl: "/api/v1/documents",
			}),
		});
	});

	it("runs a curl-compatible catalog, detail, status, history, PDF, outsider smoke", async () => {
		const catalog = await apiHono.request("/api/v1/documents", { headers: auth() });
		expect(catalog.status).toBe(200);
		for (const path of [
			`/api/v1/documents/${completedDocumentId}`,
			`/api/v1/documents/${completedDocumentId}/status`,
			`/api/v1/documents/${completedDocumentId}/history`,
		]) {
			const response = await apiHono.request(path, { headers: auth() });
			expect(response.status).toBe(200);
			const serialized = JSON.stringify(await response.json());
			expect(serialized).not.toMatch(/process-token|internal-event|senderSession|securityEvents/);
		}

		const detail = await apiHono.request(`/api/v1/documents/${completedDocumentId}`, {
			headers: auth(),
		});
		const detailBody = await detail.json();
		expect(detailBody).toEqual({
			data: expect.objectContaining({
				document: expect.objectContaining({
					documentId: completedDocumentId,
					status: "completed",
					role: "creator_and_signer",
					allowedActions: ["view_completed", "download_final_pdf", "delete"],
				}),
				retention: {
					status: "completed",
					eligibleAt: "2026-10-14T11:00:00.000Z",
					eligible: false,
				},
				history: [
					expect.objectContaining({ type: "document_uploaded", title: "Document uploaded" }),
				],
				finalPdf: expect.objectContaining({ contentType: "application/pdf" }),
			}),
		});

		const pdf = await apiHono.request(
			`/api/v1/documents/${completedDocumentId}/pdf`,
			{ headers: auth() },
			{ DOCUMENTS_BUCKET: documentsBucket() },
		);
		expect(pdf.status).toBe(200);
		expect(pdf.headers.get("content-type")).toBe("application/pdf");
		expect(new TextDecoder().decode(await pdf.arrayBuffer())).toContain(
			"agent authorized artifact",
		);

		const resourceEvents = rows(agenticSecurityEvents).filter(
			(event) =>
				!["agentic.identity.read", "agentic.document.listed"].includes(String(event.eventType)),
		);
		expect(resourceEvents.map((event) => event.eventType)).toEqual(
			expect.arrayContaining([
				"agentic.document.opened",
				"agentic.document.status_read",
				"agentic.document.history_read",
				"agentic.final_pdf.downloaded",
			]),
		);
		for (const event of resourceEvents) {
			expect(event).toEqual(
				expect.objectContaining({
					email: "owner@example.com",
					tokenId: "30000000-0000-4000-8000-000000000001",
					tokenName: "Owner agent",
					documentId: completedDocumentId,
					actorType: "agent",
				}),
			);
		}
		const serializedEvents = JSON.stringify(rows(agenticSecurityEvents));
		expect(serializedEvents).not.toContain(ownerToken);
		expect(serializedEvents).not.toContain(String(rows(agenticApiTokens)[0]?.tokenHash));

		const outsider = await apiHono.request(`/api/v1/documents/${completedDocumentId}`, {
			headers: auth(outsiderToken),
		});
		expect(outsider.status).toBe(404);
	});

	it("streams the completed PDF for creator-only and signer-only roles", async () => {
		const completedEnvelope = rows(envelopes).find((row) => row.id === completedDocumentId);
		const completedRecipient = rows(envelopeRecipients).find(
			(row) => row.envelopeId === completedDocumentId,
		);
		if (completedRecipient) completedRecipient.email = "partner@example.com";
		const creatorPdf = await apiHono.request(
			`/api/v1/documents/${completedDocumentId}/pdf`,
			{ headers: auth() },
			{ DOCUMENTS_BUCKET: documentsBucket() },
		);
		expect(creatorPdf.status).toBe(200);
		if (completedEnvelope) completedEnvelope.createdBy = "other@example.com";
		if (completedRecipient) completedRecipient.email = "owner@example.com";
		const signerPdf = await apiHono.request(
			`/api/v1/documents/${completedDocumentId}/pdf`,
			{ headers: auth() },
			{ DOCUMENTS_BUCKET: documentsBucket() },
		);
		expect(signerPdf.status).toBe(200);
	});

	it("denies revoked, deleted, outsider, not-ready, and unavailable PDF reads without bytes", async () => {
		const outsider = await apiHono.request(`/api/v1/documents/${completedDocumentId}/pdf`, {
			headers: auth(outsiderToken),
		});
		expect(outsider.status).toBe(404);
		expect(await outsider.text()).not.toContain("%PDF");

		const notReady = await apiHono.request(`/api/v1/documents/${creatorDocumentId}/pdf`, {
			headers: auth(),
		});
		expect(notReady.status).toBe(409);
		await expect(notReady.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "AGENT_FINAL_PDF_NOT_READY",
				retryable: true,
				allowedActions: ["review", "cancel", "delete"],
				recoveryUrl: `/api/v1/documents/${creatorDocumentId}/status`,
			}),
		});

		const unavailable = await apiHono.request(`/api/v1/documents/${completedDocumentId}/pdf`, {
			headers: auth(),
		});
		expect(unavailable.status).toBe(503);
		await expect(unavailable.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "AGENT_FINAL_PDF_UNAVAILABLE",
				retryable: true,
				recoveryUrl: `/api/v1/documents/${completedDocumentId}/status`,
			}),
		});

		const owner = rows(agenticApiTokens)[0];
		if (owner) owner.status = "revoked";
		const revoked = await apiHono.request(`/api/v1/documents/${completedDocumentId}`, {
			headers: auth(),
		});
		expect(revoked.status).toBe(401);
		if (owner) owner.status = "active";

		const completed = rows(envelopes).find((row) => row.id === completedDocumentId);
		if (completed) completed.status = "deleted";
		for (const path of [
			"/api/v1/documents",
			`/api/v1/documents/${completedDocumentId}`,
			`/api/v1/documents/${completedDocumentId}/status`,
			`/api/v1/documents/${completedDocumentId}/history`,
			`/api/v1/documents/${completedDocumentId}/pdf`,
		]) {
			const response = await apiHono.request(path, { headers: auth() });
			if (path === "/api/v1/documents") {
				expect(JSON.stringify(await response.json())).not.toContain(completedDocumentId);
			} else {
				expect(response.status).toBe(404);
			}
		}
	});
});
