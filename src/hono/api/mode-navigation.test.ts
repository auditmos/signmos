import { apiHono } from "@/hono/api";

const navigationMocks = vi.hoisted(() => ({
	bridgeAgentic: vi.fn(),
	bridgeHistory: vi.fn(),
	revokeAgentic: vi.fn(),
	revokeHistory: vi.fn(),
	resolveHistory: vi.fn(),
	resolveAgentic: vi.fn(),
}));

vi.mock("@/db/history-access", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/history-access")>();
	return {
		...actual,
		createHistorySessionFromVerifiedIdentity: navigationMocks.bridgeHistory,
		revokeHistorySession: navigationMocks.revokeHistory,
		resolveHistorySessionState: navigationMocks.resolveHistory,
	};
});

vi.mock("@/db/agentic-access", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/agentic-access")>();
	return {
		...actual,
		createAgenticManagementSessionFromVerifiedIdentity: navigationMocks.bridgeAgentic,
		revokeAgenticManagementSession: navigationMocks.revokeAgentic,
		resolveAgenticManagementSession: navigationMocks.resolveAgentic,
	};
});

describe("product mode navigation", () => {
	beforeEach(() => {
		navigationMocks.bridgeAgentic.mockReset();
		navigationMocks.bridgeHistory.mockReset();
		navigationMocks.revokeAgentic.mockReset();
		navigationMocks.revokeHistory.mockReset();
		navigationMocks.resolveHistory.mockReset();
		navigationMocks.resolveAgentic.mockReset();
		navigationMocks.resolveHistory.mockResolvedValue({
			state: "active",
			session: {
				id: "50000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				expiresAt: new Date("2026-07-22T16:00:00.000Z"),
			},
		});
		navigationMocks.resolveAgentic.mockResolvedValue({
			state: "active",
			session: {
				id: "60000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				expiresAt: new Date("2026-07-22T16:00:00.000Z"),
			},
		});
		navigationMocks.bridgeAgentic.mockResolvedValue({
			rawSession: "bridged-agentic-session",
			expiresAt: new Date("2026-07-22T12:15:00.000Z"),
		});
		navigationMocks.bridgeHistory.mockImplementation((input: { now: Date }) =>
			Promise.resolve({
				rawSession: "bridged-history-session",
				expiresAt: new Date(input.now.getTime() + 10 * 60 * 1000),
			}),
		);
	});

	it("signs out of both product sessions and clears both cookies", async () => {
		// Shared endpoint assumptions before RED:
		// - One same-origin action ends both verified browser sessions, even if one cookie is absent.
		// - Both cookies are cleared so cross-mode bridging cannot silently authenticate again.
		// - Missing or expired sessions remain an idempotent successful sign-out.
		const response = await apiHono.request("/api/navigate/sign-out", {
			method: "POST",
			headers: {
				cookie:
					"signmos_history_session=history-session; signmos_agentic_management=agentic-session",
				origin: "http://localhost",
			},
		});

		expect(response.status).toBe(204);
		expect(navigationMocks.revokeHistory).toHaveBeenCalledWith(
			"history-session",
			expect.any(Date),
			"unknown",
		);
		expect(navigationMocks.revokeAgentic).toHaveBeenCalledWith(
			"agentic-session",
			expect.any(Date),
			"unknown",
		);
		const cookies = response.headers.get("set-cookie") ?? "";
		expect(cookies).toMatch(/signmos_history_session=;.*Max-Age=0/i);
		expect(cookies).toMatch(/signmos_agentic_management=;.*Max-Age=0/i);
	});

	it.each([
		["only_me", "/?task=only-me"],
		["me_and_another_signer", "/?task=with-someone"],
		["my_documents", "/?task=my-documents"],
		["agentic", "/?task=agentic"],
	])("sends an unauthenticated %s choice to its email-entry view", async (mode, expected) => {
		// Session-routing assumptions before RED:
		// - A missing cookie is enough to choose the public path without a database lookup.
		// - Redirect responses are private because their destination depends on first-party cookies.
		const response = await apiHono.request(`/api/navigate/${mode}`);

		expect(response.status).toBe(302);
		expect(redirectPath(response)).toBe(expected);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(navigationMocks.resolveHistory).not.toHaveBeenCalled();
		expect(navigationMocks.resolveAgentic).not.toHaveBeenCalled();
	});

	it.each([
		["only_me", "/new-document?signingMode=only_me"],
		["me_and_another_signer", "/new-document?signingMode=me_and_another_signer"],
		["my_documents", "/my-documents"],
	])("reuses an active My Documents session for %s", async (mode, expected) => {
		const response = await apiHono.request(`/api/navigate/${mode}`, {
			headers: { cookie: "signmos_history_session=history-session" },
		});

		expect(response.status).toBe(302);
		expect(redirectPath(response)).toBe(expected);
		expect(navigationMocks.resolveHistory).toHaveBeenCalledWith(
			"history-session",
			expect.any(Date),
			"unknown",
		);
	});

	it("reuses an active Agentic management session", async () => {
		const response = await apiHono.request("/api/navigate/agentic", {
			headers: { cookie: "signmos_agentic_management=agentic-session" },
		});

		expect(response.status).toBe(302);
		expect(redirectPath(response)).toBe("/agentic-console");
		expect(navigationMocks.resolveAgentic).toHaveBeenCalledWith(
			"agentic-session",
			expect.any(Date),
			"unknown",
		);
	});

	it("bridges an active My Documents identity into Agentic mode without another email", async () => {
		const response = await apiHono.request("/api/navigate/agentic", {
			headers: { cookie: "signmos_history_session=history-session" },
		});

		expect(response.status).toBe(302);
		expect(redirectPath(response)).toBe("/agentic-console");
		expect(navigationMocks.bridgeAgentic).toHaveBeenCalledWith({
			email: "owner@example.com",
			now: expect.any(Date),
			requestIp: "unknown",
		});
		const cookie = response.headers.get("set-cookie") ?? "";
		expect(cookie).toMatch(/signmos_agentic_management=bridged-agentic-session/);
		expect(cookie).toMatch(/HttpOnly/i);
		expect(cookie).toMatch(/Secure/i);
		expect(cookie).toMatch(/SameSite=Lax/i);
		expect(cookie).toMatch(/Max-Age=900/i);
	});

	it.each([
		["only_me", "/new-document?signingMode=only_me"],
		["me_and_another_signer", "/new-document?signingMode=me_and_another_signer"],
		["my_documents", "/my-documents"],
	])("bridges an active Agentic identity into %s without another email", async (mode, expected) => {
		const response = await apiHono.request(`/api/navigate/${mode}`, {
			headers: { cookie: "signmos_agentic_management=agentic-session" },
		});

		expect(response.status).toBe(302);
		expect(redirectPath(response)).toBe(expected);
		expect(navigationMocks.bridgeHistory).toHaveBeenCalledWith({
			email: "owner@example.com",
			verifiedUntil: new Date("2026-07-22T16:00:00.000Z"),
			now: expect.any(Date),
			requestIp: "unknown",
		});
		const cookie = response.headers.get("set-cookie") ?? "";
		expect(cookie).toMatch(/signmos_history_session=bridged-history-session/);
		expect(cookie).toMatch(/HttpOnly/i);
		expect(cookie).toMatch(/Secure/i);
		expect(cookie).toMatch(/SameSite=Lax/i);
	});
});

function redirectPath(response: Response): string {
	const location = response.headers.get("location");
	if (!location) throw new Error("Expected a redirect Location header");
	const url = new URL(location, "http://localhost");
	return `${url.pathname}${url.search}`;
}
