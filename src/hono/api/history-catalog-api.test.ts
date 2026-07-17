import { apiHono } from "@/hono/api";

const historyMocks = vi.hoisted(() => ({
	list: vi.fn(),
}));

vi.mock("@/db/history-access", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/history-access")>();
	return {
		...actual,
		resolveHistorySessionState: async () => ({
			state: "active" as const,
			session: {
				id: "50000000-0000-4000-8000-000000000001",
				email: "owner@example.com",
				expiresAt: new Date("2026-07-17T16:00:00.000Z"),
			},
		}),
		listHistoryDocuments: historyMocks.list,
	};
});

describe("history catalog HTTP boundary", () => {
	beforeEach(() => {
		historyMocks.list.mockReset();
		historyMocks.list.mockResolvedValue({
			items: [
				{
					envelopeId: "00000000-0000-4000-8000-000000000001",
					title: "Contract.pdf",
					status: "sent",
					group: "needs_my_action",
					role: "signer",
				},
			],
			pagination: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 },
		});
	});

	it("passes validated server search, combined filters, and page to the authorized catalog", async () => {
		// Issue #39 assumptions before RED:
		// - The history session supplies email authority; no identity arrives in query input.
		// - Search is trimmed while role, group, status, and positive page are closed contracts.
		const response = await apiHono.request(
			"/api/history/documents?search=%20Contract%20&role=signer&group=needs_my_action&status=sent&page=2",
			{ headers: { cookie: "signmos_history_session=opaque-session" } },
		);

		expect(response.status).toBe(200);
		expect(historyMocks.list).toHaveBeenCalledWith({
			email: "owner@example.com",
			search: "Contract",
			role: "signer",
			group: "needs_my_action",
			status: "sent",
			page: 2,
		});
		await expect(response.json()).resolves.toEqual({
			data: {
				items: [
					expect.objectContaining({
						envelopeId: "00000000-0000-4000-8000-000000000001",
						title: "Contract.pdf",
					}),
				],
				pagination: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 },
			},
		});
	});

	it.each([
		"page=0",
		"page=1.5",
		"role=admin",
		"group=unknown",
		"status=unknown",
	])("rejects invalid catalog query %s before catalog work", async (query) => {
		const response = await apiHono.request(`/api/history/documents?${query}`, {
			headers: { cookie: "signmos_history_session=opaque-session" },
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "INVALID_HISTORY_CATALOG_QUERY",
				message: "Use a positive page and supported history filters",
			},
		});
		expect(historyMocks.list).not.toHaveBeenCalled();
	});
});
