import { apiHono } from "@/hono/api";

describe("agentic onboarding", () => {
	it("validates the public access request before issuing credentials", async () => {
		// Issue #44 public-boundary assumptions before RED:
		// - Input is email plus Turnstile; names and existing-document state are irrelevant.
		// - Stable validation errors may identify invalid fields but never identity eligibility.
		// - The explicit test bypass is accepted only outside production.
		// - A validated mutation still requires Idempotency-Key before persistence or delivery.
		const invalid = await apiHono.request("/api/agentic/access-requests", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		});
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toEqual({
			error: {
				code: "INVALID_AGENTIC_ACCESS_REQUEST",
				message: "A valid email and Turnstile token are required",
				fields: ["email", "turnstileToken"],
			},
		});

		const productionBypass = await apiHono.request(
			"/api/agentic/access-requests",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "agent@example.com", turnstileToken: "test-pass" }),
			},
			{ CLOUDFLARE_ENV: "production", TURNSTILE_TEST_BYPASS: "true" },
		);
		expect(productionBypass.status).toBe(403);
		await expect(productionBypass.json()).resolves.toEqual({
			error: { code: "TURNSTILE_FAILED", message: "Turnstile verification failed" },
		});

		const missingKey = await apiHono.request(
			"/api/agentic/access-requests",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "agent@example.com", turnstileToken: "test-pass" }),
			},
			{ CLOUDFLARE_ENV: "test", TURNSTILE_TEST_BYPASS: "true" },
		);
		expect(missingKey.status).toBe(400);
		await expect(missingKey.json()).resolves.toEqual({
			error: {
				code: "IDEMPOTENCY_KEY_REQUIRED",
				message: "An Idempotency-Key header is required",
			},
		});
	});
});
