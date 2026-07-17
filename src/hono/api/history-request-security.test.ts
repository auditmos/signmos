import { apiHono } from "@/hono/api";

describe("history request public security boundary", () => {
	it("rejects malformed input and failed Turnstile before history database work", async () => {
		// Issue #38 assumptions before RED:
		// - Public request parsing requires both a normalized-valid email and a Turnstile proof.
		// - Turnstile runs before rate limiting, matching, persistence, or email delivery.
		// - Invalid public inputs use stable errors that do not describe document existence.
		const missing = await apiHono.request("/api/history/access-requests", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "owner@example.com" }),
		});
		expect(missing.status).toBe(400);
		await expect(missing.json()).resolves.toEqual({
			error: {
				code: "INVALID_HISTORY_ACCESS_REQUEST",
				message: "A valid email and Turnstile token are required",
				fields: ["email", "turnstileToken"],
			},
		});

		const invalid = await apiHono.request("/api/history/access-requests", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "owner@example.com", turnstileToken: "invalid" }),
		});
		expect(invalid.status).toBe(403);
		await expect(invalid.json()).resolves.toEqual({
			error: { code: "TURNSTILE_FAILED", message: "Turnstile verification failed" },
		});
	});

	it("does not allow the explicit test bypass in production", async () => {
		const response = await apiHono.request(
			"/api/history/access-requests",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: "owner@example.com",
					turnstileToken: "test-pass",
				}),
			},
			{ CLOUDFLARE_ENV: "production", TURNSTILE_TEST_BYPASS: "true" },
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: { code: "TURNSTILE_FAILED", message: "Turnstile verification failed" },
		});
	});
});
