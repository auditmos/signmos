// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
								identity: { email: "owner@example.com", suggestedName: "Ada Lovelace" },
								items: [
									{
										envelopeId: "00000000-0000-4000-8000-000000000001",
										title: "Completed document",
										shortReference: "A1B2C3D4",
										status: "completed",
										group: "completed",
										role: "creator_and_signer",
										participants: [],
										allowedActions: ["view_completed", "download_final_pdf"],
										createdAt: "2026-07-16T08:00:00.000Z",
										activityAt: "2026-07-16T09:00:00.000Z",
										detailUrl: "/my-documents/00000000-0000-4000-8000-000000000001",
										downloadUrl: "/api/history/documents/00000000-0000-4000-8000-000000000001/pdf",
									},
								],
								pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
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
		expect(screen.getByRole("navigation", { name: "Signmos options" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "My documents" }).getAttribute("aria-current")).toBe(
			"page",
		);
		expect(await screen.findByRole("button", { name: "Start a new document" })).toBeTruthy();
		expect(await screen.findByText("Completed document")).toBeTruthy();
		expect(screen.getByRole("article").textContent).toContain("Completed");
		expect(screen.getByRole("article").textContent).toContain("Creator and signer");
		expect(screen.getByRole("link", { name: "View details" }).getAttribute("href")).toBe(
			"/my-documents/00000000-0000-4000-8000-000000000001",
		);
		expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(
			"/api/history/documents/00000000-0000-4000-8000-000000000001/pdf",
		);
		expect(document.body.textContent).not.toContain("30000000-0000-4000-8000-000000000001");
	});

	it("renders expired-session recovery with a preselected request link", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "HISTORY_SESSION_EXPIRED",
								message: "Your My documents session expired",
								recoveryUrl: "/?task=my-documents",
							},
						}),
						{ status: 401 },
					),
			),
		);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryDocumentsPage />
			</QueryClientProvider>,
		);

		const heading = await screen.findByRole("heading", { name: "Session expired" });
		expect(document.activeElement).toBe(heading);
		expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe(
			"/?task=my-documents",
		);
	});

	it("signs out through the protected session mutation and announces success", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input).endsWith("/session/sign-out")) return new Response(null, { status: 204 });
			return new Response(
				JSON.stringify({
					data: {
						items: [],
						pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 },
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const onSignedOut = vi.fn();
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryDocumentsPage onSignedOut={onSignedOut} />
			</QueryClientProvider>,
		);

		fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
		await waitFor(() => expect(onSignedOut).toHaveBeenCalledWith("/?task=my-documents"));
		expect(fetchMock).toHaveBeenLastCalledWith("/api/history/session/sign-out", {
			method: "POST",
			credentials: "same-origin",
		});
		const signedOutStatus = screen.getByText(/Signed out/);
		expect(signedOutStatus.textContent).toContain("Signed out");
		expect(document.activeElement).toBe(signedOutStatus);
	});
});
