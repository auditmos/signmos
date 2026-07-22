// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthenticatedProductNavigation, ProductModeNavigation } from "./product-mode-navigation";

describe("ProductModeNavigation", () => {
	it("offers all four sibling modes and identifies the current view", () => {
		// Navigation assumptions before RED:
		// - The four landing choices are sibling product modes, so this is primary navigation rather
		//   than a breadcrumb hierarchy.
		// - Signing links pass through a server redirect so an active My Documents session can be
		//   reused without exposing identity or session state in the browser.
		// - The same navigation remains keyboard-accessible and labels the active mode.
		render(<ProductModeNavigation activeMode="my_documents" />);

		const navigation = screen.getByRole("navigation", { name: "Signmos options" });
		expect(navigation).toBeTruthy();
		expect(screen.getByRole("link", { name: "Sign by myself" }).getAttribute("href")).toBe(
			"/api/navigate/only_me",
		);
		expect(screen.getByRole("link", { name: "Sign with someone else" }).getAttribute("href")).toBe(
			"/api/navigate/me_and_another_signer",
		);
		const myDocuments = screen.getByRole("link", { name: "My documents" });
		expect(myDocuments.getAttribute("href")).toBe("/api/navigate/my_documents");
		expect(myDocuments.getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "Agentic mode" }).getAttribute("href")).toBe(
			"/api/navigate/agentic",
		);
	});

	it("offers one shared sign-out action for authenticated product views", async () => {
		// Authenticated-navigation assumptions before RED:
		// - Sign out is adjacent to the four sibling modes on every authenticated mode view.
		// - The shared endpoint ends both product sessions, then returns to this mode's email entry.
		// - Signed-out navigation continues using ProductModeNavigation without this action.
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		const onSignedOut = vi.fn();
		const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<AuthenticatedProductNavigation activeMode="agentic" onSignedOut={onSignedOut} />
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith("/api/navigate/sign-out", {
				method: "POST",
				credentials: "same-origin",
			}),
		);
		expect(onSignedOut).toHaveBeenCalledWith("/?task=agentic");
	});
});
