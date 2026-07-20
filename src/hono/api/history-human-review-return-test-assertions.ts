import { apiHono } from "@/hono/api";

const historyTestEnv = {
	APP_BASE_URL: "http://localhost",
	CLOUDFLARE_ENV: "development",
	TURNSTILE_TEST_BYPASS: "true",
};

export async function expectPasswordlessHumanReviewReturn() {
	const returnTo = "/human-review/c9000000-0000-4000-8000-000000000001";
	const requestResponse = await apiHono.request(
		"/api/history/access-requests",
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"idempotency-key": "history-review-return-key",
				"x-now": "2026-07-17T08:00:00.000Z",
				"x-signmos-debug": "history-access-link",
			},
			body: JSON.stringify({
				email: "owner@example.com",
				turnstileToken: "test-pass",
				returnTo,
			}),
		},
		historyTestEnv,
	);
	const requestBody = (await requestResponse.json()) as {
		data: { debug: { accessUrl: string } };
	};
	const accessUrl = new URL(requestBody.data.debug.accessUrl);
	expect(accessUrl.searchParams.get("returnTo")).toBe(returnTo);
	const rawCredential = accessUrl.pathname.split("/").at(-1);

	const redeemed = await apiHono.request(`/api/history/access-links/${rawCredential}/redeem`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			"x-now": "2026-07-17T08:01:00.000Z",
		},
		body: JSON.stringify({ returnTo }),
	});
	expect(redeemed.status).toBe(201);
	await expect(redeemed.json()).resolves.toEqual({
		data: { status: "authenticated", redirectUrl: returnTo },
	});
}
