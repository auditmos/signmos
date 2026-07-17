// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoryAccessConfirmationPage } from "./history-access-confirmation-page";

describe("HistoryAccessConfirmationPage", () => {
	it("inspects on GET and redeems only after the intentional confirmation action", async () => {
		// Issue #37 assumptions before RED:
		// - Rendering performs one non-consuming inspection GET.
		// - Only the labelled confirmation button triggers redemption POST.
		// - The confirmation screen contains no document metadata.
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				return new Response(
					JSON.stringify({ data: { status: "authenticated", redirectUrl: "/my-documents" } }),
					{ status: 201 },
				);
			}
			return new Response(
				JSON.stringify({
					data: { state: "confirm", expiresAt: "2026-07-17T08:30:00.000Z" },
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const onAuthenticated = vi.fn();
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryAccessConfirmationPage
					credential="raw-link-credential"
					onAuthenticated={onAuthenticated}
				/>
			</QueryClientProvider>,
		);

		expect(
			await screen.findByRole("heading", { name: "Confirm My documents access" }),
		).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/history/access-links/raw-link-credential",
			expect.objectContaining({ method: "GET" }),
		);
		expect(document.body.textContent).not.toContain("contract.pdf");

		fireEvent.click(await screen.findByRole("button", { name: "Continue to My documents" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/history/access-links/raw-link-credential/redeem",
			expect.objectContaining({ method: "POST" }),
		);
		expect(onAuthenticated).toHaveBeenCalledWith("/my-documents");
	});
});
