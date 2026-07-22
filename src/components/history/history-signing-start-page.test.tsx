// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HistorySigningStartPage } from "./history-signing-start-page";

describe("HistorySigningStartPage", () => {
	it.each([
		["only_me", "Sign a PDF by yourself", "Sign by myself"],
		["me_and_another_signer", "Sign a PDF with someone else", "Sign with someone else"],
	] as const)("opens a focused authenticated %s start view", async (signingMode, heading, option) => {
		// Dedicated-start assumptions before RED:
		// - Product navigation leaves the document catalog and opens one focused start view.
		// - The active history session supplies email and suggested name without another challenge.
		// - The requested signing mode is selected but remains editable before envelope creation.
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								identity: { email: "owner@example.com", suggestedName: "Ada Lovelace" },
								items: [],
								pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 },
							},
						}),
					),
			),
		);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistorySigningStartPage signingMode={signingMode} />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeTruthy();
		expect(screen.getByRole("navigation", { name: "Signmos options" })).toBeTruthy();
		expect(screen.getByRole("link", { name: option }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
		expect(await screen.findByRole("form", { name: "Start a new document" })).toBeTruthy();
		expect(screen.getByLabelText("Your verified email").textContent).toBe("owner@example.com");
		expect((screen.getByLabelText(option) as HTMLInputElement).checked).toBe(true);
		expect(screen.queryByRole("heading", { name: "My documents" })).toBeNull();
		expect(screen.queryByLabelText("Email")).toBeNull();
		expect(screen.queryByText(/Turnstile/i)).toBeNull();
	});
});
