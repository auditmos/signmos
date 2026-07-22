import { apiHono } from "@/hono/api";

const navigationMocks = vi.hoisted(() => ({
	resolveHistory: vi.fn(),
	resolveAgentic: vi.fn(),
}));

vi.mock("@/db/history-access", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/history-access")>();
	return { ...actual, resolveHistorySessionState: navigationMocks.resolveHistory };
});

vi.mock("@/db/agentic-access", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/agentic-access")>();
	return { ...actual, resolveAgenticManagementSession: navigationMocks.resolveAgentic };
});

describe("product mode navigation", () => {
	beforeEach(() => {
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
		["only_me", "/my-documents?start=only_me"],
		["me_and_another_signer", "/my-documents?start=me_and_another_signer"],
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
});

function redirectPath(response: Response): string {
	const location = response.headers.get("location");
	if (!location) throw new Error("Expected a redirect Location header");
	const url = new URL(location, "http://localhost");
	return `${url.pathname}${url.search}`;
}
