import { rateLimitRecords } from "@/db/envelope";
import { apiHono } from "@/hono/api";
import {
	agentApiRateLimitOperation,
	agentApiRateLimitPolicy,
} from "@/hono/api/agent-v1-rate-limit";
import { agentHeaders, creatorToken, resetAgentPartnerFixture } from "./agent-partner-test-fixture";
import { selfSignRows as rows, agentSelfSignTestState as state } from "./agent-self-sign-test-db";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("./agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

describe("agent measured rate-limit boundaries", () => {
	beforeEach(resetAgentPartnerFixture);

	it("allows the exact per-token limit and returns stable recovery metadata above it", async () => {
		seedRateLimit({
			key: "token:a1000000-0000-4000-8000-000000000001",
			attempts: agentApiRateLimitPolicy.token.limit - 2,
		});

		const below = await apiHono.request("/api/v1/me", {
			headers: agentHeaders(creatorToken),
		});
		expect(below.status).toBe(200);
		expectRateHeaders(below, agentApiRateLimitPolicy.token.limit, 1);

		const exact = await apiHono.request("/api/v1/me", {
			headers: agentHeaders(creatorToken),
		});
		expect(exact.status).toBe(200);
		expectRateHeaders(exact, agentApiRateLimitPolicy.token.limit, 0);

		const above = await apiHono.request("/api/v1/me", {
			headers: agentHeaders(creatorToken),
		});
		expect(above.status).toBe(429);
		expectRateHeaders(above, agentApiRateLimitPolicy.token.limit, 0);
		expect(above.headers.get("retry-after")).toBe("60");
		await expect(above.json()).resolves.toEqual({
			error: {
				code: "AGENT_RATE_LIMITED",
				message: "Agent API rate limit exceeded",
				limit: agentApiRateLimitPolicy.token.limit,
				retryable: true,
				retryAfter: 60,
				allowedActions: ["retry_after_backoff"],
				recoveryUrl: "/agent.md#polling-and-rate-limits",
			},
		});
	});

	it("allows the exact defensive per-IP limit and rejects the next request", async () => {
		seedRateLimit({
			key: "ip:203.0.113.8",
			attempts: agentApiRateLimitPolicy.ip.limit - 2,
		});
		const headers = {
			...agentHeaders(creatorToken),
			"cf-connecting-ip": "203.0.113.8",
		};

		const below = await apiHono.request("/api/v1/me", { headers });
		expect(below.status).toBe(200);
		expectRateHeaders(below, agentApiRateLimitPolicy.ip.limit, 1);

		const exact = await apiHono.request("/api/v1/me", { headers });
		expect(exact.status).toBe(200);
		expectRateHeaders(exact, agentApiRateLimitPolicy.ip.limit, 0);

		const above = await apiHono.request("/api/v1/me", { headers });
		expect(above.status).toBe(429);
		expectRateHeaders(above, agentApiRateLimitPolicy.ip.limit, 0);
		await expect(above.json()).resolves.toEqual({
			error: expect.objectContaining({
				code: "AGENT_RATE_LIMITED",
				limit: agentApiRateLimitPolicy.ip.limit,
				retryable: true,
			}),
		});
	});
});

function seedRateLimit(input: { key: string; attempts: number }) {
	rows(rateLimitRecords).push({
		id: `d1000000-0000-4000-8000-${String(rows(rateLimitRecords).length + 1).padStart(12, "0")}`,
		key: input.key,
		operation: agentApiRateLimitOperation,
		attempts: input.attempts,
		resetAt: new Date(state.now.getTime() + 60_000),
		createdAt: state.now,
		updatedAt: state.now,
	});
}

function expectRateHeaders(response: Response, limit: number, remaining: number) {
	expect(response.headers.get("ratelimit-limit")).toBe(String(limit));
	expect(response.headers.get("ratelimit-remaining")).toBe(String(remaining));
	expect(response.headers.get("ratelimit-reset")).toBe(
		String(Math.ceil((state.now.getTime() + 60_000) / 1_000)),
	);
}
