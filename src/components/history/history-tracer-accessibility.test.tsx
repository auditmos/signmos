// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { StartEnvelopePage } from "@/components/sender/start-envelope-page";
import { HistoryAccessConfirmationPage } from "./history-access-confirmation-page";
import { HistoryDocumentDetailPage } from "./history-document-detail-page";
import { HistoryDocumentsPage } from "./history-documents-page";

const envelopeId = "00000000-0000-4000-8000-000000000001";

function renderWithQuery(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function expectVisibleKeyboardFocus(element: HTMLElement) {
	expect(element.className).toContain("focus-visible:");
}

describe("history recovery tracer accessibility", () => {
	afterEach(() => cleanup());

	it("uses labelled native controls and visible keyboard focus across the tracer", async () => {
		// Issue #37 assumptions before RED:
		// - Native buttons, inputs, and anchors supply keyboard activation semantics.
		// - Every text input has a programmatic label.
		// - Every action has an explicit focus-visible style instead of relying on hover alone.
		vi.stubGlobal("crypto", { randomUUID: () => "form-idempotency-key" });
		renderWithQuery(<StartEnvelopePage testTurnstileToken="test-pass" />);
		for (const name of ["Sign by myself", "Sign with someone else", "My documents"]) {
			const choice = screen.getByRole("button", { name });
			expect(choice.tagName).toBe("BUTTON");
			expectVisibleKeyboardFocus(choice);
		}
		fireEvent.click(screen.getByRole("button", { name: "My documents" }));
		expect(screen.getByLabelText("Email").tagName).toBe("INPUT");
		expectVisibleKeyboardFocus(screen.getByRole("button", { name: "Email me a secure link" }));
		expectVisibleKeyboardFocus(screen.getByRole("button", { name: "Back to task choices" }));

		cleanup();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: { state: "confirm", expiresAt: "2026-07-17T08:30:00.000Z" },
						}),
					),
			),
		);
		renderWithQuery(
			<HistoryAccessConfirmationPage credential="raw-credential" onAuthenticated={vi.fn()} />,
		);
		expectVisibleKeyboardFocus(
			await screen.findByRole("button", { name: "Continue to My documents" }),
		);

		cleanup();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								items: [
									{
										envelopeId,
										title: "Completed document",
										shortReference: "A1B2C3D4",
										status: "completed",
										group: "completed",
										role: "creator",
										participants: [],
										allowedActions: ["view_completed", "download_final_pdf"],
										createdAt: "2026-07-16T08:00:00.000Z",
										activityAt: "2026-07-16T09:00:00.000Z",
										detailUrl: `/my-documents/${envelopeId}`,
										downloadUrl: `/api/history/documents/${envelopeId}/pdf`,
									},
								],
								pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
							},
						}),
					),
			),
		);
		renderWithQuery(<HistoryDocumentsPage />);
		expectVisibleKeyboardFocus(await screen.findByRole("link", { name: "View details" }));
		expectVisibleKeyboardFocus(screen.getByRole("link", { name: "Download PDF" }));

		cleanup();
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
								parties: [],
								history: [],
							},
						}),
					),
			),
		);
		renderWithQuery(<HistoryDocumentDetailPage envelopeId={envelopeId} />);
		expectVisibleKeyboardFocus(await screen.findByRole("link", { name: "Back to My documents" }));
		expectVisibleKeyboardFocus(await screen.findByRole("link", { name: "Download signed PDF" }));
	});
});
