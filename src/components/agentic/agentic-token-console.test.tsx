// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
	it("automatically selects a newly generated token in always-visible prompt controls", async () => {
		// Issue #44 console assumptions before RED:
		// - TanStack Form owns name/acknowledgment validation; Query owns the mutation.
		// - The secret is held only in immediate component state and disappears on reload/unmount.
		// - A newly generated token becomes the selected prompt source automatically.
		// - Always-visible radio controls can switch between that token and the environment variable.
		const secret = `signmos_${"a".repeat(43)}`;
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			if ((init?.method ?? "GET") === "GET") {
				return new Response(JSON.stringify({ data: { activeLimit: 5, tokens: [] } }), {
					status: 200,
				});
			}
			return new Response(
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
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const writeText = vi.fn(async () => undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		const view = renderConsole();
		expect(document.body.textContent).toContain("send, sign, decline, cancel, and delete");
		await screen.findByText(/no agentic tokens yet/i);
		expect(screen.getByRole("group", { name: "Token used in Agent prompt" })).toBeTruthy();
		expect(
			(
				screen.getByRole("radio", {
					name: "Use environment variable ($SIGNMOS_TOKEN)",
				}) as HTMLInputElement
			).checked,
		).toBe(true);
		fireEvent.change(screen.getByLabelText("Token name"), {
			target: { value: "Laptop agent" },
		});
		fireEvent.click(screen.getByLabelText(/I understand this token can/i));
		fireEvent.click(screen.getByRole("button", { name: "Generate token" }));

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith("/api/agentic/tokens", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: "Laptop agent",
					acknowledgeFullAuthority: true,
				}),
			}),
		);
		expect(await screen.findByText(secret)).toBeTruthy();
		const promptElement = screen.getByTestId("agent-prompt");
		const prompt = promptElement.textContent ?? "";
		expect(prompt).toContain(
			"Read https://signmos.com/agent.md and https://signmos.com/openapi.json",
		);
		expect(prompt).toContain(secret);
		expect(prompt).not.toContain("$SIGNMOS_TOKEN");
		expect(
			(screen.getByRole("radio", { name: "Use Laptop agent" }) as HTMLInputElement).checked,
		).toBe(true);
		expect(prompt).not.toMatch(/Codex|Claude/i);
		expect(screen.getByRole("link", { name: "Open Agent guide" }).getAttribute("href")).toBe(
			"https://signmos.com/agent.md",
		);
		expect(screen.getByRole("link", { name: "OpenAPI schema" }).getAttribute("href")).toBe(
			"https://signmos.com/openapi.json",
		);

		fireEvent.click(screen.getByRole("button", { name: "Copy token setup" }));
		fireEvent.click(screen.getByRole("button", { name: "Copy agent prompt" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
		expect(writeText).toHaveBeenNthCalledWith(1, `export SIGNMOS_TOKEN='${secret}'`);
		expect(writeText).toHaveBeenNthCalledWith(2, prompt);

		fireEvent.click(
			screen.getByRole("radio", { name: "Use environment variable ($SIGNMOS_TOKEN)" }),
		);
		expect(promptElement.textContent).toContain("$SIGNMOS_TOKEN");
		expect(promptElement.textContent).not.toContain(secret);
		fireEvent.click(screen.getByRole("radio", { name: "Use Laptop agent" }));
		expect(promptElement.textContent).toContain(secret);

		view.unmount();
		renderConsole();
		expect(screen.queryByText(secret)).toBeNull();
	});

	it("shows loading and empty states for safe token metadata", async () => {
		let resolveFetch: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						resolveFetch = resolve;
					}),
			),
		);

		renderConsole();
		expect(screen.getByRole("status").textContent).toMatch(/loading agentic tokens/i);
		resolveFetch?.(
			new Response(JSON.stringify({ data: { activeLimit: 5, tokens: [] } }), { status: 200 }),
		);
		await screen.findByText(/no agentic tokens yet/i);
	});

	it("uses a saved full token when only existing token metadata can be loaded", async () => {
		// Existing-token assumptions before RED:
		// - Listing responses expose only safe metadata and cannot recover the raw token.
		// - A full token pasted by the user stays in browser-only component state.
		// - Typing a full token selects it as the prompt source without persisting it.
		const savedSecret = `signmos_${"c".repeat(43)}`;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								activeLimit: 5,
								tokens: [
									{
										id: "30000000-0000-4000-8000-000000000001",
										name: "Existing agent",
										hint: "signmos_…cccc",
										createdAt: "2026-07-17T08:00:00.000Z",
										lastUsedAt: null,
										status: "active",
										revokedAt: null,
									},
								],
							},
						}),
						{ status: 200 },
					),
			),
		);

		renderConsole();
		await screen.findByText("1 of 5 active");
		expect(screen.getByText(/existing tokens cannot be recovered/i)).toBeTruthy();
		const fullTokenInput = screen.getByLabelText("Full token");
		expect((fullTokenInput as HTMLInputElement).type).toBe("password");
		fireEvent.change(fullTokenInput, { target: { value: savedSecret } });

		expect(
			(screen.getByRole("radio", { name: "Use a saved full token" }) as HTMLInputElement).checked,
		).toBe(true);
		expect(screen.getByTestId("agent-prompt").textContent).toContain(savedSecret);
		expect(screen.getByTestId("agent-prompt").textContent).not.toContain("$SIGNMOS_TOKEN");
	});

	it("enforces the visible limit and confirms independent revocation", async () => {
		const tokens = Array.from({ length: 5 }, (_, index) => ({
			id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
			name: `Agent ${index + 1}`,
			hint: `signmos_…000${index + 1}`,
			createdAt: "2026-07-17T08:00:00.000Z",
			lastUsedAt: index === 0 ? "2026-07-17T09:00:00.000Z" : null,
			status: "active" as const,
			revokedAt: null as string | null,
		}));
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "DELETE") {
				const token = tokens.find((candidate) => String(input).endsWith(candidate.id));
				if (!token) return new Response(null, { status: 404 });
				Object.assign(token, {
					status: "revoked",
					revokedAt: "2026-07-17T09:10:00.000Z",
				});
				return new Response(JSON.stringify({ data: { token } }), { status: 200 });
			}
			return new Response(JSON.stringify({ data: { activeLimit: 5, tokens } }), {
				status: 200,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		renderConsole();
		await screen.findByText("5 of 5 active");
		expect(
			(screen.getByRole("button", { name: "Generate token" }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(screen.getByText("signmos_…0001")).toBeTruthy();
		expect(screen.getByText(/last used.*jul/i)).toBeTruthy();
		expect(screen.getAllByText(/never used/i)).toHaveLength(4);

		fireEvent.click(screen.getByRole("button", { name: "Revoke Agent 2" }));
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getByText(/revoke agent 2/i)).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "Confirm revoke" }));

		await screen.findByText("4 of 5 active");
		expect(
			(screen.getByRole("button", { name: "Generate token" }) as HTMLButtonElement).disabled,
		).toBe(false);
		expect(screen.getByRole("heading", { name: /agent 2.*revoked/i })).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/agentic/tokens/30000000-0000-4000-8000-000000000002",
			expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
		);
	});

	it("announces clipboard failure for manual recovery", async () => {
		const secret = `signmos_${"b".repeat(43)}`;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				if ((init?.method ?? "GET") === "GET") {
					return new Response(JSON.stringify({ data: { activeLimit: 5, tokens: [] } }), {
						status: 200,
					});
				}
				return new Response(
					JSON.stringify({
						data: {
							secret,
							token: {
								id: "30000000-0000-4000-8000-000000000001",
								name: "Failing clipboard",
								hint: "signmos_…bbbb",
								createdAt: "2026-07-17T08:00:00.000Z",
							},
						},
					}),
					{ status: 201 },
				);
			}),
		);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
		});
		renderConsole();
		await screen.findByText(/no agentic tokens yet/i);
		fireEvent.change(screen.getByLabelText("Token name"), {
			target: { value: "Failing clipboard" },
		});
		fireEvent.click(screen.getByLabelText(/I understand this token can/i));
		fireEvent.click(screen.getByRole("button", { name: "Generate token" }));
		await screen.findByText(secret);
		fireEvent.click(screen.getByRole("button", { name: "Copy token setup" }));
		await screen.findByText(/copy failed.*manually/i);
	});

	it.each([
		{
			name: "expired session",
			status: 401,
			body: {
				error: {
					code: "AGENTIC_MANAGEMENT_SESSION_EXPIRED",
					message: "Verify your email again",
					recoveryUrl: "/?task=agentic",
				},
			},
			expected: /session expired/i,
		},
		{
			name: "API failure",
			status: 500,
			body: { error: { code: "INTERNAL_ERROR", message: "Unavailable" } },
			expected: /unable to load agentic tokens/i,
		},
	])("shows an accessible $name state", async ({ status, body, expected }) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(body), { status })),
		);
		renderConsole();
		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toMatch(expected);
		if (status === 401) {
			expect(screen.getByRole("link", { name: /verify email again/i }).getAttribute("href")).toBe(
				"/?task=agentic",
			);
		}
	});
});
