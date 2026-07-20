import {
	agentLifecycleSmokeFiles,
	runLiveSelfSignSmoke,
	validateAgentSmokeEntry,
} from "../../scripts/agentic-smoke";

describe("agent release smoke", () => {
	it("uses a base URL, public docs, and SIGNMOS_TOKEN only as a Bearer header", async () => {
		const token = `signmos_${"s".repeat(43)}`;
		const requests: Array<{ url: string; authorization: string | null }> = [];
		const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const request = new Request(input, init);
			requests.push({
				url: request.url,
				authorization: request.headers.get("authorization"),
			});
			if (request.url.endsWith("/agent.md")) return new Response("# Signmos Agent API");
			if (request.url.endsWith("/openapi.json")) {
				return Response.json({ openapi: "3.1.0", paths: { "/api/v1/me": {} } });
			}
			return Response.json({
				data: {
					principal: { email: "smoke@example.test", actorType: "agent" },
					token: { name: "Smoke fixture" },
				},
			});
		});

		const identity = await validateAgentSmokeEntry({
			baseUrl: "https://signmos.test/",
			token,
			fetcher: fetcher as typeof fetch,
		});
		expect(identity).toEqual({ email: "smoke@example.test", tokenName: "Smoke fixture" });
		expect(requests.map((request) => request.url)).toEqual([
			"https://signmos.test/agent.md",
			"https://signmos.test/openapi.json",
			"https://signmos.test/api/v1/me",
		]);
		expect(requests.slice(0, 2).every((request) => request.authorization === null)).toBe(true);
		expect(requests[2]?.authorization).toBe(`Bearer ${token}`);
		expect(JSON.stringify(requests.map((request) => request.url))).not.toContain(token);
	});

	it("retains named Bearer lifecycle branches for the runnable smoke", () => {
		for (const file of [
			"agent-self-sign.test.ts",
			"agent-two-party-delivery.test.ts",
			"agent-partner-change-request.test.ts",
			"agent-partner-decline.test.ts",
			"agent-partner-completion.test.ts",
			"agent-revision-loop.test.ts",
			"agent-creator-controls.test.ts",
			"agent-command-idempotency.test.ts",
		]) {
			expect(agentLifecycleSmokeFiles.join("\n")).toContain(file);
		}
	});

	it("pauses a live protected command for matching-human review before polling the result", async () => {
		const token = `signmos_${"l".repeat(43)}`;
		const documentId = "00000000-0000-4000-8000-000000000051";
		const requests: Request[] = [];
		const responses = [
			Response.json({ data: { documentId } }, { status: 201 }),
			Response.json({ data: {} }, { status: 201 }),
			Response.json({ data: {} }, { status: 201 }),
			Response.json(
				{
					data: {
						commandId: "c0000000-0000-4000-8000-000000000051",
						status: "pending_human_review",
						reviewUrl: "https://signmos.test/human-review/r0000000-0000-4000-8000-000000000051",
						statusUrl: "https://signmos.test/api/v1/commands/c0000000-0000-4000-8000-000000000051",
						expiresAt: "2026-07-21T10:00:00.000Z",
						notificationStatus: "sent",
					},
				},
				{ status: 202 },
			),
			Response.json({ data: { finalPdfAvailable: false } }, { status: 200 }),
			Response.json(
				{
					data: {
						commandId: "c0000000-0000-4000-8000-000000000051",
						status: "completed",
					},
				},
				{ status: 200 },
			),
			Response.json({ data: { finalPdfAvailable: true } }, { status: 200 }),
			new Response("%PDF-1.7\n%%EOF", {
				status: 200,
				headers: { "content-type": "application/pdf" },
			}),
		];
		const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			requests.push(new Request(input, init));
			const response = responses.shift();
			if (!response) throw new Error("Unexpected smoke request");
			return response;
		});

		await expect(
			runLiveSelfSignSmoke({
				baseUrl: "https://signmos.test/",
				token,
				onReviewRequired: async (review) => {
					expect(review).toEqual(
						expect.objectContaining({
							status: "pending_human_review",
							reviewUrl: expect.stringContaining("/human-review/"),
						}),
					);
				},
				pollIntervalMs: 0,
				fetcher: fetcher as typeof fetch,
			}),
		).resolves.toEqual({ finalPdfBytes: 14 });

		expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			"POST https://signmos.test/api/v1/documents",
			`PUT https://signmos.test/api/v1/documents/${documentId}/source-pdf`,
			`POST https://signmos.test/api/v1/documents/${documentId}/fields/defaults`,
			`POST https://signmos.test/api/v1/documents/${documentId}/complete`,
			`GET https://signmos.test/api/v1/documents/${documentId}/status`,
			"GET https://signmos.test/api/v1/commands/c0000000-0000-4000-8000-000000000051",
			`GET https://signmos.test/api/v1/documents/${documentId}/status`,
			`GET https://signmos.test/api/v1/documents/${documentId}/pdf`,
		]);
		for (const request of requests) {
			expect(request.headers.get("authorization")).toBe(`Bearer ${token}`);
			if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
				expect(request.headers.get("idempotency-key")).toBeTruthy();
			}
			expect(request.url).not.toContain(token);
		}
	});
});
