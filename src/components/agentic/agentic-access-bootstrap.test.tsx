// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { AgenticAccessBootstrap } from "./agentic-access-bootstrap";

describe("agent credential redaction bootstrap", () => {
	it("removes the link credential from the browser URL before inspection", async () => {
		const rawCredential = "raw-agentic-fragment-canary";
		window.history.replaceState(null, "", `/agentic-access#${rawCredential}`);
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: { state: "confirm", expiresAt: "2026-07-17T08:30:00.000Z" },
					}),
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<AgenticAccessBootstrap />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(window.location.pathname).toBe("/agentic-access");
		expect(window.location.hash).toBe("");
		expect(document.body.textContent).not.toContain(rawCredential);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/agentic/access-links/inspect",
			expect.objectContaining({ body: JSON.stringify({ credential: rawCredential }) }),
		);
	});
});
