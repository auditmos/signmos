// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgenticAccessConfirmationPage } from "./agentic-access-confirmation-page";

describe("agentic onboarding confirmation", () => {
	it("inspects without consuming and redeems only after explicit confirmation", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input).endsWith("/redeem")) {
				return new Response(
					JSON.stringify({
						data: { status: "authenticated", redirectUrl: "/agentic-console" },
					}),
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
				<AgenticAccessConfirmationPage
					credential="raw-agentic-link"
					onAuthenticated={onAuthenticated}
				/>
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { name: "Confirm Agentic access" })).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/agentic/access-links/inspect",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ credential: "raw-agentic-link" }),
			}),
		);

		fireEvent.click(await screen.findByRole("button", { name: "Continue to token management" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/agentic/access-links/redeem",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ credential: "raw-agentic-link" }),
			}),
		);
		expect(onAuthenticated).toHaveBeenCalledWith("/agentic-console");
	});
});
