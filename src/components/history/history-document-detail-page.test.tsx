// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HistoryDocumentDetailPage } from "./history-document-detail-page";

describe("HistoryDocumentDetailPage", () => {
	it("renders completed detail with a session-scoped PDF action", async () => {
		const envelopeId = "00000000-0000-4000-8000-000000000001";
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								envelopeId,
								status: "completed",
								finalPdf: {
									downloadUrl: `/api/history/documents/${envelopeId}/pdf`,
									contentType: "application/pdf",
									byteSize: 42,
									sha256: "a".repeat(64),
									createdAt: "2026-07-16T09:00:00.000Z",
								},
								parties: [
									{
										id: "recipient-1",
										name: "Owner Example",
										email: "owner@example.com",
										status: "completed",
										signedDate: null,
										signedAt: null,
									},
								],
								history: [],
							},
						}),
					),
			),
		);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryDocumentDetailPage envelopeId={envelopeId} />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { name: "Completed document" })).toBeTruthy();
		expect(await screen.findByText("Owner Example")).toBeTruthy();
		expect(screen.getByText("owner@example.com")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Download signed PDF" }).getAttribute("href")).toBe(
			`/api/history/documents/${envelopeId}/pdf`,
		);
		expect(document.body.textContent).not.toContain("30000000-0000-4000-8000-000000000001");
	});
});
