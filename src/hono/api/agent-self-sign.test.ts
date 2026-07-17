import { PDFDocument } from "pdf-lib";
import { agenticApiTokens, agenticSecurityEvents } from "@/db/agentic-access";
import { hashAgenticCredential } from "@/db/agentic-access/request";
import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	signatureProfiles,
	signerTokens,
	sourceDocuments,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";
import {
	agentSelfSignBucket,
	agentSelfSignTables,
	extractPdfVisibleText,
	selfSignRows,
	agentSelfSignTestState as state,
} from "./agent-self-sign-test-db";

const rawToken = "signmos_agent_self_sign_token";
const tokenId = "a0000000-0000-4000-8000-000000000001";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

function commandHeaders(key: string, contentType = "application/json") {
	return {
		authorization: `Bearer ${rawToken}`,
		"content-type": contentType,
		"idempotency-key": key,
		"x-now": state.now.toISOString(),
	};
}

async function createUploadedDraft(key: string, bucket: R2Bucket): Promise<string> {
	const created = await apiHono.request("/api/v1/documents", {
		method: "POST",
		headers: commandHeaders(`${key}-create`),
		body: JSON.stringify({ name: "Ada Lovelace" }),
	});
	const documentId = ((await created.json()) as { data: { documentId: string } }).data.documentId;
	const uploaded = await apiHono.request(
		`/api/v1/documents/${documentId}/source-pdf`,
		{
			method: "PUT",
			headers: commandHeaders(`${key}-upload`, "application/pdf"),
			body: "%PDF-1.7\nself sign workflow\n%%EOF",
		},
		{ DOCUMENTS_BUCKET: bucket },
	);
	expect(uploaded.status).toBe(201);
	return documentId;
}

function securityEventsOfType(eventType: string) {
	return selfSignRows(agenticSecurityEvents).filter((event) => event.eventType === eventType);
}

describe("agent self-sign lifecycle", () => {
	beforeEach(async () => {
		state.rows = new Map(agentSelfSignTables.map((table) => [table, []]));
		state.r2Objects.clear();
		state.r2PutCounts.clear();
		state.now = new Date("2026-07-17T10:00:00.000Z");
		selfSignRows(agenticApiTokens).push({
			id: tokenId,
			email: "ada@example.com",
			name: "Ada self-sign token",
			tokenHash: await hashAgenticCredential(rawToken),
			tokenHint: "signmos_...oken",
			status: "active",
			activeSlot: 1,
			lastUsedAt: null,
			revokedAt: null,
			createdAt: new Date("2026-07-17T08:00:00.000Z"),
		});
	});

	it("creates a verified normalized-email self-sign draft without another credential or email", async () => {
		const response = await apiHono.request("/api/v1/documents", {
			method: "POST",
			headers: commandHeaders("create-self-sign-1"),
			body: JSON.stringify({ name: "Ada Lovelace" }),
		});

		expect(response.status).toBe(201);
		const body = (await response.json()) as {
			data: { documentId: string; status: string; signingMode: string; sender: unknown };
		};
		expect(body.data).toEqual({
			documentId: expect.any(String),
			status: "draft",
			signingMode: "only_me",
			sender: { name: "Ada Lovelace", email: "ada@example.com" },
			allowedActions: expect.arrayContaining(["upload_source_pdf"]),
		});
		expect(selfSignRows(envelopes)).toEqual([
			expect.objectContaining({
				id: body.data.documentId,
				status: "draft",
				signingMode: "only_me",
				createdBy: "ada@example.com",
				createdByName: "Ada Lovelace",
			}),
		]);
		expect(selfSignRows(envelopeRecipients)).toEqual([
			expect.objectContaining({
				envelopeId: body.data.documentId,
				name: "Ada Lovelace",
				email: "ada@example.com",
				status: "pending",
			}),
		]);
		expect(selfSignRows(auditEvents)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventType: "sender.start.created", message: "ada@example.com" }),
				expect.objectContaining({ eventType: "sender.verified", message: "ada@example.com" }),
			]),
		);
		expect(selfSignRows(agenticSecurityEvents)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					tokenId,
					documentId: body.data.documentId,
					email: "ada@example.com",
					actorType: "agent",
					eventType: "agentic.document.created",
				}),
			]),
		);
	});

	it("stores one valid source PDF and rejects invalid and exactly over-limit inputs", async () => {
		const created = await apiHono.request("/api/v1/documents", {
			method: "POST",
			headers: commandHeaders("create-for-source"),
			body: JSON.stringify({ name: "Ada Lovelace" }),
		});
		const documentId = ((await created.json()) as { data: { documentId: string } }).data.documentId;
		const bucket = agentSelfSignBucket();
		const pdf = new TextEncoder().encode("%PDF-1.7\nself sign source\n%%EOF");

		const uploaded = await apiHono.request(
			`/api/v1/documents/${documentId}/source-pdf`,
			{
				method: "PUT",
				headers: {
					...commandHeaders("upload-source-1", "application/pdf"),
					"x-source-filename": "agreement.pdf",
				},
				body: pdf,
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(uploaded.status).toBe(201);
		const uploadBody = (await uploaded.json()) as {
			data: { sha256: string; byteSize: number; version: number; downloadUrl: string };
		};
		expect(uploadBody.data).toEqual(
			expect.objectContaining({
				byteSize: pdf.byteLength,
				contentType: "application/pdf",
				originalFilename: "agreement.pdf",
				version: 1,
				sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
				downloadUrl: `/api/v1/documents/${documentId}/source-pdf/content`,
			}),
		);
		expect(selfSignRows(sourceDocuments)).toEqual([
			expect.objectContaining({
				envelopeId: documentId,
				byteSize: pdf.byteLength,
				sha256: uploadBody.data.sha256,
				contentType: "application/pdf",
				version: 1,
				r2Key: `envelopes/${documentId}/source-v1.pdf`,
			}),
		]);
		const replayed = await apiHono.request(
			`/api/v1/documents/${documentId}/source-pdf`,
			{
				method: "PUT",
				headers: {
					...commandHeaders("upload-source-1", "application/pdf"),
					"x-source-filename": "agreement.pdf",
				},
				body: pdf,
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(replayed.status).toBe(201);
		await expect(replayed.json()).resolves.toEqual({ data: uploadBody.data });
		const binaryConflict = await apiHono.request(
			`/api/v1/documents/${documentId}/source-pdf`,
			{
				method: "PUT",
				headers: {
					...commandHeaders("upload-source-1", "application/pdf"),
					"x-source-filename": "agreement.pdf",
				},
				body: "%PDF-1.7\nchanged content\n%%EOF",
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(binaryConflict.status).toBe(409);
		await expect(binaryConflict.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }),
		});
		expect(selfSignRows(sourceDocuments)).toHaveLength(1);
		expect(state.r2PutCounts.get(`envelopes/${documentId}/source-v1.pdf`)).toBe(1);

		const invalid = await apiHono.request(
			`/api/v1/documents/${documentId}/source-pdf`,
			{
				method: "PUT",
				headers: commandHeaders("upload-invalid", "text/plain"),
				body: "not a pdf",
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "INVALID_SOURCE_PDF", fields: ["body"] }),
		});

		const overLimit = new Uint8Array(10 * 1024 * 1024 + 1);
		overLimit.set(new TextEncoder().encode("%PDF-1.7"));
		const oversized = await apiHono.request(
			`/api/v1/documents/${documentId}/source-pdf`,
			{
				method: "PUT",
				headers: commandHeaders("upload-over-limit", "application/pdf"),
				body: overLimit,
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(oversized.status).toBe(413);
		await expect(oversized.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "SOURCE_PDF_TOO_LARGE",
				limitBytes: 10 * 1024 * 1024,
				fields: ["body"],
			}),
		});
		expect(selfSignRows(sourceDocuments)).toHaveLength(1);
	});

	it("validates reusable typed/drawn profiles and isolates them to the verified email", async () => {
		const bucket = agentSelfSignBucket();
		const documentId = await createUploadedDraft("profile", bucket);
		const withoutConsent = await apiHono.request(
			`/api/v1/documents/${documentId}/signature-profiles`,
			{
				method: "POST",
				headers: commandHeaders("profile-no-consent"),
				body: JSON.stringify({
					profile: { kind: "typed", label: "Ada", typedText: "Ada", typedFont: "cursive" },
					rememberSignature: false,
				}),
			},
		);
		expect(withoutConsent.status).toBe(400);
		await expect(withoutConsent.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "SIGNATURE_REUSE_CONSENT_REQUIRED" }),
		});
		expect(selfSignRows(signatureProfiles)).toHaveLength(0);

		const typed = await apiHono.request(`/api/v1/documents/${documentId}/signature-profiles`, {
			method: "POST",
			headers: commandHeaders("profile-typed"),
			body: JSON.stringify({
				profile: {
					kind: "typed",
					label: "Ada reusable",
					typedText: "Ada Lovelace",
					typedFont: "cursive",
				},
				rememberSignature: true,
			}),
		});
		expect(typed.status).toBe(201);
		const typedReplay = await apiHono.request(
			`/api/v1/documents/${documentId}/signature-profiles`,
			{
				method: "POST",
				headers: commandHeaders("profile-typed"),
				body: JSON.stringify({
					profile: {
						kind: "typed",
						label: "Ada reusable",
						typedText: "Ada Lovelace",
						typedFont: "cursive",
					},
					rememberSignature: true,
				}),
			},
		);
		expect(typedReplay.status).toBe(201);
		expect(selfSignRows(signatureProfiles)).toHaveLength(1);
		state.now = new Date("2026-07-17T10:01:00.000Z");
		const drawn = await apiHono.request(`/api/v1/documents/${documentId}/signature-profiles`, {
			method: "POST",
			headers: commandHeaders("profile-drawn"),
			body: JSON.stringify({
				profile: { kind: "drawn", label: "Ada drawn", svgPath: "M 1 1 L 40 20" },
				rememberSignature: true,
			}),
		});
		expect(drawn.status).toBe(201);
		expect(selfSignRows(signatureProfiles)).toHaveLength(2);
		expect(
			selfSignRows(signatureProfiles).every((row) => row.createdBy === "ada@example.com"),
		).toBe(true);
		const selected = await apiHono.request(
			`/api/v1/documents/${documentId}/signature-profiles/selected`,
			{ headers: commandHeaders("unused-read-key") },
		);
		expect(selected.status).toBe(200);
		await expect(selected.json()).resolves.toEqual({
			data: expect.objectContaining({ kind: "drawn", createdBy: "ada@example.com" }),
		});
		const outsiderToken = "signmos_profile_outsider_token";
		selfSignRows(agenticApiTokens).push({
			id: "a0000000-0000-4000-8000-000000000002",
			email: "outsider@example.com",
			name: "Outsider",
			tokenHash: await hashAgenticCredential(outsiderToken),
			tokenHint: "signmos_...ider",
			status: "active",
			activeSlot: 1,
			lastUsedAt: null,
			revokedAt: null,
			createdAt: state.now,
		});
		const isolated = await apiHono.request(
			`/api/v1/documents/${documentId}/signature-profiles/selected`,
			{ headers: { authorization: `Bearer ${outsiderToken}`, "x-now": state.now.toISOString() } },
		);
		expect(isolated.status).toBe(404);
		await expect(isolated.json()).resolves.toEqual({
			error: expect.objectContaining({ code: "AGENT_DOCUMENT_NOT_FOUND" }),
		});
	});

	it("prepares, reviews, repositions, completes, polls, and downloads a self-signed artifact", async () => {
		const bucket = agentSelfSignBucket();
		const documentId = await createUploadedDraft("complete", bucket);
		const prepared = await apiHono.request(`/api/v1/documents/${documentId}/fields/defaults`, {
			method: "POST",
			headers: commandHeaders("default-fields"),
			body: JSON.stringify({ page: 1 }),
		});
		expect(prepared.status).toBe(201);
		const preparedBody = (await prepared.json()) as {
			data: { status: string; fields: Array<{ id: string; type: string }> };
		};
		expect(preparedBody.data.status).toBe("sent");
		expect(preparedBody.data.fields).toEqual([
			expect.objectContaining({ type: "signature", page: 1, x: 360, y: 628 }),
			expect.objectContaining({ type: "date", page: 1, x: 420, y: 688 }),
		]);
		expect(selfSignRows(signerTokens)).toHaveLength(1);
		expect(JSON.stringify(preparedBody)).not.toMatch(/signerToken|signingUrl|\/signing\//);
		const preparedReplay = await apiHono.request(
			`/api/v1/documents/${documentId}/fields/defaults`,
			{
				method: "POST",
				headers: commandHeaders("default-fields"),
				body: JSON.stringify({ page: 1 }),
			},
		);
		expect(preparedReplay.status).toBe(201);
		await expect(preparedReplay.json()).resolves.toEqual(preparedBody);
		expect(selfSignRows(envelopeFields)).toHaveLength(2);
		expect(selfSignRows(signerTokens)).toHaveLength(1);
		expect(selfSignRows(emailSendRecords)).toHaveLength(1);
		expect(securityEventsOfType("agentic.fields.prepared")).toHaveLength(1);

		const task = await apiHono.request(`/api/v1/documents/${documentId}/signing-task`, {
			headers: commandHeaders("unused-task-key"),
		});
		expect(task.status).toBe(200);
		const taskBody = (await task.json()) as {
			data: {
				sourceDocument: { downloadUrl: string };
				fields: Array<{ id: string; type: string }>;
			};
		};
		expect(taskBody.data.sourceDocument.downloadUrl).toBe(
			`/api/v1/documents/${documentId}/source-pdf/content`,
		);
		expect(taskBody.data.fields).toHaveLength(2);
		const signatureField = taskBody.data.fields.find((field) => field.type === "signature");
		expect(signatureField).toBeTruthy();

		const repositioned = await apiHono.request(
			`/api/v1/documents/${documentId}/fields/${signatureField?.id}`,
			{
				method: "PATCH",
				headers: commandHeaders("reposition-field"),
				body: JSON.stringify({ page: 1, x: 96, y: 192 }),
			},
		);
		expect(repositioned.status).toBe(200);
		await expect(repositioned.json()).resolves.toEqual({
			data: expect.objectContaining({ id: signatureField?.id, x: 96, y: 192 }),
		});
		const repositionReplay = await apiHono.request(
			`/api/v1/documents/${documentId}/fields/${signatureField?.id}`,
			{
				method: "PATCH",
				headers: commandHeaders("reposition-field"),
				body: JSON.stringify({ page: 1, x: 96, y: 192 }),
			},
		);
		expect(repositionReplay.status).toBe(200);
		expect(securityEventsOfType("agentic.field.repositioned")).toHaveLength(1);

		const completed = await apiHono.request(
			`/api/v1/documents/${documentId}/complete`,
			{
				method: "POST",
				headers: commandHeaders("complete-self-sign"),
				body: JSON.stringify({
					signature: { kind: "typed", typedText: "Ada Lovelace", typedFont: "cursive" },
					rememberSignature: false,
					date: "2099-12-31",
				}),
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(completed.status).toBe(200);
		await expect(completed.json()).resolves.toEqual({
			data: expect.objectContaining({ envelopeId: documentId, envelopeStatus: "completed" }),
		});
		const completedReplay = await apiHono.request(
			`/api/v1/documents/${documentId}/complete`,
			{
				method: "POST",
				headers: commandHeaders("complete-self-sign"),
				body: JSON.stringify({
					signature: { kind: "typed", typedText: "Ada Lovelace", typedFont: "cursive" },
					rememberSignature: false,
					date: "2099-12-31",
				}),
			},
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(completedReplay.status).toBe(200);
		expect(selfSignRows(fieldValues)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ value: "Ada Lovelace" }),
				expect.objectContaining({ value: "2026-07-17" }),
			]),
		);
		expect(selfSignRows(fieldValues)).toHaveLength(2);
		expect(selfSignRows(finalDocuments)).toHaveLength(1);
		expect(securityEventsOfType("agentic.self_sign.completed")).toHaveLength(1);
		const finalKey = selfSignRows(finalDocuments)[0]?.r2Key;
		expect(typeof finalKey).toBe("string");
		expect(typeof finalKey === "string" ? state.r2PutCounts.get(finalKey) : undefined).toBe(1);
		const finalBytes = typeof finalKey === "string" ? state.r2Objects.get(finalKey) : undefined;
		expect(finalBytes).toBeTruthy();
		expect(extractPdfVisibleText(finalBytes ?? new Uint8Array())).toContain("Ada Lovelace");
		expect(extractPdfVisibleText(finalBytes ?? new Uint8Array())).toContain("AUDIT CERTIFICATE");
		expect(extractPdfVisibleText(finalBytes ?? new Uint8Array())).toContain(
			"Certificate checksum:",
		);

		for (const path of [
			`/api/v1/documents/${documentId}`,
			`/api/v1/documents/${documentId}/status`,
			`/api/v1/documents/${documentId}/history`,
		]) {
			const response = await apiHono.request(path, { headers: commandHeaders("unused-read") });
			expect(response.status, path).toBe(200);
			expect(JSON.stringify(await response.json())).not.toMatch(/signmos_|signerToken|r2Key/);
		}
		const finalPdf = await apiHono.request(
			`/api/v1/documents/${documentId}/pdf`,
			{ headers: commandHeaders("unused-final-read") },
			{ DOCUMENTS_BUCKET: bucket },
		);
		expect(finalPdf.status).toBe(200);
		expect(finalPdf.headers.get("content-type")).toBe("application/pdf");
		expect(await PDFDocument.load(await finalPdf.arrayBuffer())).toBeTruthy();
		expect(selfSignRows(envelopeFields)).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: signatureField?.id, x: 96, y: 192 })]),
		);
		expect(JSON.stringify([...state.rows.values()])).not.toContain(rawToken);
	});
});
