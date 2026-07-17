// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HistoryDocumentsPage } from "./history-documents-page";

describe("HistoryDocumentsPage", () => {
	it("renders completed rows with session-scoped detail and download actions", async () => {
		// Issue #37 assumptions before RED:
		// - The tracer catalog renders completed documents only.
		// - Detail and PDF actions are ordinary labelled links for keyboard/assistive access.
		// - No final-document bearer token is present in the returned row or rendered DOM.
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								documents: [
									{
										envelopeId: "00000000-0000-4000-8000-000000000001",
										status: "completed",
										role: "creator_and_signer",
										detailUrl: "/my-documents/00000000-0000-4000-8000-000000000001",
										downloadUrl: "/api/history/documents/00000000-0000-4000-8000-000000000001/pdf",
									},
								],
							},
						}),
					),
			),
		);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryDocumentsPage />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { name: "My documents" })).toBeTruthy();
		expect(await screen.findByText("Completed document")).toBeTruthy();
		expect(screen.getByText("Completed")).toBeTruthy();
		expect(screen.getByRole("article").textContent).toContain("Creator and signer");
		expect(screen.getByRole("link", { name: "View details" }).getAttribute("href")).toBe(
			"/my-documents/00000000-0000-4000-8000-000000000001",
		);
		expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(
			"/api/history/documents/00000000-0000-4000-8000-000000000001/pdf",
		);
		expect(document.body.textContent).not.toContain("30000000-0000-4000-8000-000000000001");
	});
});
