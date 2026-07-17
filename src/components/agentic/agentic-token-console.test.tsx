// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgenticTokenConsole } from "./agentic-token-console";

function renderConsole() {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AgenticTokenConsole />
		</QueryClientProvider>,
	);
}

describe("agent token console", () => {
	it("acknowledges full authority and keeps the one-time secret separate from the prompt", async () => {
		// Issue #44 console assumptions before RED:
		// - TanStack Form owns name/acknowledgment validation; Query owns the mutation.
		// - The secret is held only in immediate component state and disappears on reload/unmount.
		// - Token setup and the platform-neutral prompt have separate accessible copy controls.
		const secret = `signmos_${"a".repeat(43)}`;
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							secret,
							token: {
								id: "30000000-0000-4000-8000-000000000001",
								name: "Laptop agent",
								hint: "signmos_…aaaa",
								createdAt: "2026-07-17T08:00:00.000Z",
							},
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const writeText = vi.fn(async () => undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		const view = renderConsole();
		expect(document.body.textContent).toContain("send, sign, decline, cancel, and delete");
		fireEvent.change(screen.getByLabelText("Token name"), {
			target: { value: "Laptop agent" },
		});
		fireEvent.click(screen.getByLabelText(/I understand this token can/i));
		fireEvent.click(screen.getByRole("button", { name: "Generate token" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith("/api/agentic/tokens", {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Laptop agent",
				acknowledgeFullAuthority: true,
			}),
		});
		expect(screen.getByText(secret)).toBeTruthy();
		const prompt = screen.getByTestId("agent-prompt").textContent ?? "";
		expect(prompt).toContain("$SIGNMOS_TOKEN");
		expect(prompt).toContain("/agent.md");
		expect(prompt).toContain("/openapi.json");
		expect(prompt).not.toContain(secret);
		expect(prompt).not.toMatch(/Codex|Claude/i);

		fireEvent.click(screen.getByRole("button", { name: "Copy token setup" }));
		fireEvent.click(screen.getByRole("button", { name: "Copy agent prompt" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
		expect(writeText).toHaveBeenNthCalledWith(1, `export SIGNMOS_TOKEN='${secret}'`);
		expect(writeText).toHaveBeenNthCalledWith(2, prompt);

		view.unmount();
		renderConsole();
		expect(screen.queryByText(secret)).toBeNull();
	});
});
