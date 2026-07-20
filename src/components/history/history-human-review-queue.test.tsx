// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HistoryHumanReviewQueue } from "./history-human-review-queue";

describe("My Documents human review queue", () => {
	it("shows only active review requests returned by the verified-session boundary", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								items: [
									{
										commandId: "d9000000-0000-4000-8000-000000000001",
										documentId: "e9000000-0000-4000-8000-000000000001",
										title: "review-me.pdf",
										actionLabel: "Sign and complete",
										agentName: "Ada review agent",
										status: "pending_human_review",
										expiresAt: "2026-07-18T10:00:00.000Z",
										reviewUrl: "/human-review/c9000000-0000-4000-8000-000000000001",
									},
								],
							},
						}),
					),
			),
		);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryHumanReviewQueue />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { name: "Pending human reviews" })).toBeTruthy();
		expect(screen.getByText("review-me.pdf")).toBeTruthy();
		expect(screen.getByText(/Sign and complete requested by Ada review agent/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Review requested action" }).getAttribute("href")).toBe(
			"/human-review/c9000000-0000-4000-8000-000000000001",
		);
	});
});
