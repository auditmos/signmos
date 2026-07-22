// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { ProductModeNavigation } from "./product-mode-navigation";

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
});
