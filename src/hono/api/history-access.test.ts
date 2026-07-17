import { envelopeRecipients, envelopes, finalDocuments } from "@/db/envelope";
import { historyAccessLinks, historyEmailRecords, historySessions } from "@/db/history-access";
import { apiHono } from "@/hono/api";

const completedEnvelopeId = "00000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	recipientsTable: null as unknown,
	finalDocumentsTable: null as unknown,
	historyLinksTable: null as unknown,
	historyEmailRecordsTable: null as unknown,
	historySessionsTable: null as unknown,
	envelopes: [] as Array<Record<string, unknown>>,
	recipients: [] as Array<Record<string, unknown>>,
	finalDocuments: [] as Array<Record<string, unknown>>,
	historyLinks: [] as Array<Record<string, unknown>>,
	historyEmailRecords: [] as Array<Record<string, unknown>>,
	historySessions: [] as Array<Record<string, unknown>>,
	insertedLinkStatuses: [] as string[],
}));

function selectRows(table: unknown): Array<Record<string, unknown>> {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.recipientsTable) return state.recipients;
	if (table === state.finalDocumentsTable) return state.finalDocuments;
	if (table === state.historyLinksTable) return state.historyLinks;
	if (table === state.historyEmailRecordsTable) return state.historyEmailRecords;
	if (table === state.historySessionsTable) return state.historySessions;
	return [];
}

function insertRows(
	table: unknown,
	rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const target =
		table === state.historyLinksTable
			? state.historyLinks
			: table === state.historyEmailRecordsTable
				? state.historyEmailRecords
				: table === state.historySessionsTable
					? state.historySessions
					: [];
	if (table === state.historyLinksTable) {
		state.insertedLinkStatuses.push(...rows.map((row) => String(row.status)));
	}
	const inserted = rows.map((row, index) => ({
		id: `10000000-0000-4000-8000-${String(target.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-07-17T08:00:00.000Z"),
		...row,
	}));
	target.push(...inserted);
	return inserted;
}

function updateRows(
	table: unknown,
	values: Record<string, unknown>,
): Array<Record<string, unknown>> {
	if (table !== state.historyLinksTable) return [];
	const targetStatus = String(values.status);
	const eligibleIndex = state.historyLinks.findIndex((row) => {
		if (targetStatus === "active") return row.status === "pending";
		if (targetStatus === "consumed") {
			return (
				row.status === "active" &&
				row.expiresAt instanceof Date &&
				values.consumedAt instanceof Date &&
				row.expiresAt > values.consumedAt
			);
		}
		return true;
	});
	if (eligibleIndex < 0) return [];
	const current = state.historyLinks[eligibleIndex];
	if (!current) return [];
	const updated = { ...current, ...values };
	state.historyLinks[eligibleIndex] = updated;
	return [updated];
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({ limit: async () => selectRows(table) }),
				limit: async () => selectRows(table),
			}),
		}),
		insert: (table: unknown) => ({
			values: (rows: Array<Record<string, unknown>> | Record<string, unknown>) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: () => ({ returning: async () => updateRows(table, values) }),
			}),
		}),
	}),
}));

describe("history access tracer", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.recipientsTable = envelopeRecipients;
		state.finalDocumentsTable = finalDocuments;
		state.historyLinksTable = historyAccessLinks;
		state.historyEmailRecordsTable = historyEmailRecords;
		state.historySessionsTable = historySessions;
		state.envelopes = [
			{
				id: completedEnvelopeId,
				status: "completed",
				signingMode: "me_and_another_signer",
				createdBy: "owner@example.com",
				createdAt: new Date("2026-07-16T08:00:00.000Z"),
				sentBy: "owner@example.com",
				sentAt: new Date("2026-07-16T08:05:00.000Z"),
			},
		];
		state.recipients = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: completedEnvelopeId,
				name: "Owner Example",
				email: "owner@example.com",
				status: "completed",
				createdAt: new Date("2026-07-16T08:01:00.000Z"),
			},
		];
		state.finalDocuments = [
			{
				id: "30000000-0000-4000-8000-000000000001",
				envelopeId: completedEnvelopeId,
				r2Key: `envelopes/${completedEnvelopeId}/final.pdf`,
				sha256: "a".repeat(64),
				byteSize: 42,
				contentType: "application/pdf",
				createdAt: new Date("2026-07-16T09:00:00.000Z"),
			},
		];
		state.historyLinks = [];
		state.historyEmailRecords = [];
		state.historySessions = [];
		state.insertedLinkStatuses = [];
	});

	it("issues one hashed completed-document access link and metadata-free email", async () => {
		// Issue #37 assumptions before RED:
		// - This tracer handles only a matching retained completed document.
		// - The link starts pending and becomes active after the delivery boundary accepts it.
		// - Raw credentials are restricted to delivery and an explicit non-production debug surface.
		// - Turnstile, rate limits, unmatched parity, and delivery failures belong to issue #38.
		const response = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({ email: " OWNER@EXAMPLE.COM " }),
			},
			{ APP_BASE_URL: "http://localhost", CLOUDFLARE_ENV: "development" },
		);

		expect(response.status).toBe(202);
		const body = (await response.json()) as {
			data: { status: string; debug: { accessUrl: string } };
		};
		expect(body.data.status).toBe("accepted");
		expect(body.data.debug.accessUrl).toMatch(/^http:\/\/localhost\/history-access\//);
		const rawCredential = body.data.debug.accessUrl.split("/").at(-1) ?? "";
		expect(rawCredential.length).toBeGreaterThan(20);

		expect(state.insertedLinkStatuses).toEqual(["pending"]);
		expect(state.historyLinks).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "active",
			}),
		]);
		expect(state.historyLinks[0]?.credentialHash).not.toBe(rawCredential);
		expect(JSON.stringify(state.historyLinks)).not.toContain(rawCredential);
		expect(state.historyEmailRecords).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				kind: "history_access",
				deliveryStatus: "accepted",
			}),
		]);
		expect(JSON.stringify(state.historyEmailRecords)).not.toContain(rawCredential);
	});

	it("keeps the incomplete tracer request boundary disabled in production", async () => {
		const response = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "owner@example.com" }),
			},
			{ APP_BASE_URL: "https://signmos.example", CLOUDFLARE_ENV: "production" },
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "HISTORY_ACCESS_NOT_AVAILABLE",
				message: "My documents access is not available in this environment",
			},
		});
		expect(state.historyLinks).toEqual([]);
		expect(state.historyEmailRecords).toEqual([]);
	});

	it("renders repeated link confirmation reads without consuming the credential", async () => {
		// Issue #37 assumptions before RED:
		// - GET is an inspection-only boundary for email security scanners and browser previews.
		// - A valid active link renders confirmation without producing a session.
		// - Confirmation prevents the raw URL from propagating through the Referrer header.
		const requestResponse = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({ email: "owner@example.com" }),
			},
			{ APP_BASE_URL: "http://localhost", CLOUDFLARE_ENV: "development" },
		);
		const requestBody = (await requestResponse.json()) as {
			data: { debug: { accessUrl: string } };
		};
		const rawCredential = requestBody.data.debug.accessUrl.split("/").at(-1) ?? "";

		for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
			const response = await apiHono.request(`/api/history/access-links/${rawCredential}`, {
				headers: { "x-now": "2026-07-17T08:29:59.000Z" },
			});
			expect(response.status).toBe(200);
			expect(response.headers.get("referrer-policy")).toBe("no-referrer");
			await expect(response.json()).resolves.toEqual({
				data: { state: "confirm", expiresAt: "2026-07-17T08:30:00.000Z" },
			});
		}

		expect(state.historyLinks[0]?.status).toBe("active");
		expect(state.historyLinks[0]?.consumedAt).toBeUndefined();
		expect(state.historySessions).toEqual([]);
	});

	it.each([
		"2026-07-17T08:30:00.000Z",
		"2026-07-17T08:30:00.001Z",
	])("rejects redemption at and after the 30-minute boundary (%s)", async (redemptionTime) => {
		const requestResponse = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({ email: "owner@example.com" }),
			},
			{ APP_BASE_URL: "http://localhost", CLOUDFLARE_ENV: "development" },
		);
		const requestBody = (await requestResponse.json()) as {
			data: { debug: { accessUrl: string } };
		};
		const rawCredential = requestBody.data.debug.accessUrl.split("/").at(-1) ?? "";

		const response = await apiHono.request(`/api/history/access-links/${rawCredential}/redeem`, {
			method: "POST",
			headers: { origin: "http://localhost", "x-now": redemptionTime },
		});

		expect(response.status).toBe(410);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "HISTORY_LINK_EXPIRED",
				message: "This My documents link has expired",
			},
		});
		expect(state.historySessions).toEqual([]);
	});

	it("atomically redeems one link into one hashed fixed-expiry session", async () => {
		// Issue #37 assumptions before RED:
		// - Redemption requires an intentional same-origin POST.
		// - One conditional link update is the atomic replay/concurrency boundary.
		// - The raw session credential exists only in the response cookie.
		// - The session lifetime is fixed at eight hours from successful redemption.
		const requestResponse = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({ email: "owner@example.com" }),
			},
			{ APP_BASE_URL: "http://localhost", CLOUDFLARE_ENV: "development" },
		);
		const requestBody = (await requestResponse.json()) as {
			data: { debug: { accessUrl: string } };
		};
		const rawCredential = requestBody.data.debug.accessUrl.split("/").at(-1) ?? "";
		const redeemRequest = () =>
			apiHono.request(`/api/history/access-links/${rawCredential}/redeem`, {
				method: "POST",
				headers: {
					origin: "http://localhost",
					"x-now": "2026-07-17T08:29:59.000Z",
				},
			});

		const responses = await Promise.all([redeemRequest(), redeemRequest()]);
		const success = responses.find((response) => response.status === 201);
		const replay = responses.find((response) => response.status === 409);
		expect(success).toBeTruthy();
		expect(replay).toBeTruthy();
		await expect(success?.json()).resolves.toEqual({
			data: { status: "authenticated", redirectUrl: "/my-documents" },
		});
		await expect(replay?.json()).resolves.toEqual({
			error: {
				code: "HISTORY_LINK_CONSUMED",
				message: "This My documents link has already been used",
			},
		});

		const cookie = success?.headers.get("set-cookie") ?? "";
		expect(cookie).toContain("signmos_history_session=");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("SameSite=Lax");
		const rawSession = cookie.match(/signmos_history_session=([^;]+)/)?.[1] ?? "";
		expect(rawSession.length).toBeGreaterThan(20);
		expect(state.historyLinks[0]).toEqual(
			expect.objectContaining({
				status: "consumed",
				consumedAt: new Date("2026-07-17T08:29:59.000Z"),
			}),
		);
		expect(state.historySessions).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				sessionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: "active",
				expiresAt: new Date("2026-07-17T16:29:59.000Z"),
			}),
		]);
		expect(JSON.stringify(state.historySessions)).not.toContain(rawSession);
	});

	it("lists only session-authorized completed documents and rejects unrelated identifiers", async () => {
		// Issue #37 assumptions before RED:
		// - The minimal tracer catalog contains completed envelopes only.
		// - Creator or recipient email involvement grants read access; unrelated identity does not.
		// - History URLs use the envelope id plus the HTTP-only session and expose no process token.
		const unrelatedEnvelopeId = "00000000-0000-4000-8000-000000000099";
		const recipientEnvelopeId = "00000000-0000-4000-8000-000000000050";
		state.envelopes.push({
			id: unrelatedEnvelopeId,
			status: "completed",
			signingMode: "only_me",
			createdBy: "unrelated@example.com",
			createdAt: new Date("2026-07-15T08:00:00.000Z"),
			sentBy: "unrelated@example.com",
			sentAt: new Date("2026-07-15T08:05:00.000Z"),
		});
		state.finalDocuments.push({
			id: "30000000-0000-4000-8000-000000000099",
			envelopeId: unrelatedEnvelopeId,
			r2Key: `envelopes/${unrelatedEnvelopeId}/final.pdf`,
			sha256: "b".repeat(64),
			byteSize: 99,
			contentType: "application/pdf",
			createdAt: new Date("2026-07-15T09:00:00.000Z"),
		});
		state.envelopes.push({
			id: recipientEnvelopeId,
			status: "completed",
			signingMode: "me_and_another_signer",
			createdBy: "sender@example.com",
			createdAt: new Date("2026-07-14T08:00:00.000Z"),
			sentBy: "sender@example.com",
			sentAt: new Date("2026-07-14T08:05:00.000Z"),
		});
		state.recipients.push({
			id: "20000000-0000-4000-8000-000000000050",
			envelopeId: recipientEnvelopeId,
			name: "Owner As Recipient",
			email: "owner@example.com",
			status: "completed",
			createdAt: new Date("2026-07-14T08:01:00.000Z"),
		});
		state.finalDocuments.push({
			id: "30000000-0000-4000-8000-000000000050",
			envelopeId: recipientEnvelopeId,
			r2Key: `envelopes/${recipientEnvelopeId}/final.pdf`,
			sha256: "c".repeat(64),
			byteSize: 50,
			contentType: "application/pdf",
			createdAt: new Date("2026-07-14T09:00:00.000Z"),
		});
		const requestResponse = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-now": "2026-07-17T08:00:00.000Z",
					"x-signmos-debug": "history-access-link",
				},
				body: JSON.stringify({ email: "owner@example.com" }),
			},
			{ APP_BASE_URL: "http://localhost", CLOUDFLARE_ENV: "development" },
		);
		const requestBody = (await requestResponse.json()) as {
			data: { debug: { accessUrl: string } };
		};
		const rawCredential = requestBody.data.debug.accessUrl.split("/").at(-1) ?? "";
		const redemption = await apiHono.request(`/api/history/access-links/${rawCredential}/redeem`, {
			method: "POST",
			headers: { origin: "http://localhost", "x-now": "2026-07-17T08:29:59.000Z" },
		});
		const cookie = redemption.headers.get("set-cookie")?.split(";")[0] ?? "";

		const catalogResponse = await apiHono.request("/api/history/documents", {
			headers: { cookie, "x-now": "2026-07-17T16:29:58.000Z" },
		});
		expect(catalogResponse.status).toBe(200);
		const catalog = await catalogResponse.json();
		expect(catalog).toEqual({
			data: {
				documents: [
					{
						envelopeId: completedEnvelopeId,
						status: "completed",
						role: "creator_and_signer",
						detailUrl: `/my-documents/${completedEnvelopeId}`,
						downloadUrl: `/api/history/documents/${completedEnvelopeId}/pdf`,
					},
					{
						envelopeId: recipientEnvelopeId,
						status: "completed",
						role: "signer",
						detailUrl: `/my-documents/${recipientEnvelopeId}`,
						downloadUrl: `/api/history/documents/${recipientEnvelopeId}/pdf`,
					},
				],
			},
		});
		expect(JSON.stringify(catalog)).not.toContain("30000000-0000-4000-8000-000000000001");

		const unrelatedResponse = await apiHono.request(
			`/api/history/documents/${unrelatedEnvelopeId}`,
			{ headers: { cookie, "x-now": "2026-07-17T16:29:58.000Z" } },
		);
		expect(unrelatedResponse.status).toBe(404);
		await expect(unrelatedResponse.json()).resolves.toEqual({
			error: {
				code: "HISTORY_DOCUMENT_NOT_FOUND",
				message: "Document not found for this My documents session",
			},
		});
	});
});
