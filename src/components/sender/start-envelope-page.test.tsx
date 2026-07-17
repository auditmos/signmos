// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { StartEnvelopePage } from "./start-envelope-page";

function renderStartEnvelopePage(props: ComponentProps<typeof StartEnvelopePage> = {}) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<StartEnvelopePage {...props} />
		</QueryClientProvider>,
	);
}

describe("StartEnvelopePage", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "form-idempotency-key" });
	});

	it("starts with three equal task choices and reveals only the selected task", () => {
		// Issue #37 assumptions before RED:
		// - No task is selected when the landing page first renders.
		// - The three task labels are the stable public choice contract.
		// - My documents asks for email only; request submission is tested in a later slice.
		// - Returning to the chooser removes task-specific form state from the visible UI.
		renderStartEnvelopePage({ testTurnstileToken: "test-pass" });

		expect(screen.getByRole("button", { name: "Sign by myself" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Sign with someone else" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "My documents" })).toBeTruthy();
		expect(screen.queryByRole("form", { name: "Start envelope" })).toBeNull();
		expect(screen.queryByRole("form", { name: "Request My documents access" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "My documents" }));

		expect(screen.getByRole("form", { name: "Request My documents access" })).toBeTruthy();
		expect(screen.getByLabelText("Email")).toBeTruthy();
		expect(screen.queryByLabelText("Name")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Back to task choices" }));
		expect(screen.queryByRole("form", { name: "Request My documents access" })).toBeNull();
	});

	it("requests My documents access with email only", async () => {
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ data: { status: "accepted" } }), { status: 202 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderStartEnvelopePage({ testTurnstileToken: "test-pass" });

		fireEvent.click(screen.getByRole("button", { name: "My documents" }));
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "owner@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Email me a secure link" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith("/api/history/access-requests", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"idempotency-key": "form-idempotency-key",
			},
			body: JSON.stringify({ email: "owner@example.com", turnstileToken: "test-pass" }),
		});
		expect((await screen.findByRole("status")).textContent).toContain("Check your email");
		expect(screen.getByRole("button", { name: "Back to task choices" })).toBeTruthy();
	});

	it("submits the selected partner-signing task through the existing sender-start contract", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "awaiting_verification",
							signingMode: "me_and_another_signer",
							sender: {
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							allowedActions: ["verify_sender_email"],
							verification: {
								email: "ada@example.com",
								expiresAt: "2026-05-21T09:30:00.000Z",
							},
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		renderStartEnvelopePage({ testTurnstileToken: "test-pass" });
		fireEvent.click(screen.getByRole("button", { name: "Sign with someone else" }));

		const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
		const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
		fireEvent.change(emailInput, { target: { value: "ada@example.com" } });

		expect(nameInput.value).toBe("Ada Lovelace");
		expect(emailInput.value).toBe("ada@example.com");
		expect(screen.queryByRole("radio")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/sender-start",
			expect.objectContaining({
				body: JSON.stringify({
					signingMode: "me_and_another_signer",
					name: "Ada Lovelace",
					email: "ada@example.com",
					turnstileToken: "test-pass",
				}),
			}),
		);
	});

	it("blocks sender start when Turnstile is not configured", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		renderStartEnvelopePage();
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		const alert = screen.getByRole("alert");
		const startButton = screen.getByRole("button", { name: "Start envelope" });

		expect(alert.textContent).toContain("Turnstile is not configured");
		expect((startButton as HTMLButtonElement).disabled).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("renders the Turnstile widget when the API is loaded", async () => {
		const renderTurnstile = vi.fn((container: HTMLElement) => {
			const iframe = document.createElement("iframe");
			iframe.title = "Turnstile challenge";
			container.appendChild(iframe);
			return "widget-id";
		});
		vi.stubGlobal("turnstile", { render: renderTurnstile });

		renderStartEnvelopePage({ turnstileSiteKey: "site-key" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		await waitFor(() =>
			expect(renderTurnstile).toHaveBeenCalledWith(expect.any(HTMLElement), {
				sitekey: "site-key",
			}),
		);
		expect(screen.getByTitle("Turnstile challenge")).toBeTruthy();
	});

	it("requires a completed Turnstile challenge when the widget has no response", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		renderStartEnvelopePage({ turnstileSiteKey: "site-key" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Complete the Turnstile challenge");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("submits the completed Turnstile widget response", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "awaiting_verification",
							sender: {
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							verification: {
								email: "ada@example.com",
								expiresAt: "2026-05-21T09:30:00.000Z",
							},
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		renderStartEnvelopePage({ turnstileSiteKey: "site-key" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		const widgetResponse = document.createElement("input");
		widgetResponse.type = "hidden";
		widgetResponse.name = "cf-turnstile-response";
		widgetResponse.value = "widget-pass";
		screen.getByRole("form", { name: "Start envelope" }).appendChild(widgetResponse);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/sender-start",
			expect.objectContaining({
				body: JSON.stringify({
					signingMode: "only_me",
					name: "Ada Lovelace",
					email: "ada@example.com",
					turnstileToken: "widget-pass",
				}),
			}),
		);
	});

	it("submits sender details and shows sent-email confirmation without a verification link", async () => {
		// Assumptions for issue #23:
		// - The normal sender-start UI is not a developer/debug surface.
		// - The API may create a fallback URL for email records, but normal UI must not render it.
		// - Turnstile test bypass remains explicit through this component prop and route env.
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "awaiting_verification",
							sender: {
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							allowedActions: ["verify_sender_email"],
							verification: {
								email: "ada@example.com",
								expiresAt: "2026-05-21T09:30:00.000Z",
								fallbackUrl: "http://localhost/sender-verifications/sender-token",
							},
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		renderStartEnvelopePage({ testTurnstileToken: "test-pass" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		await screen.findByText("Check your email");
		expect(screen.getByText("Verification was sent to ada@example.com.")).toBeTruthy();
		expect(screen.queryByRole("link", { name: /verification/i })).toBeNull();
		expect(document.body.textContent).not.toContain("http://localhost/sender-verifications");
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/sender-start",
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "form-idempotency-key",
				},
				body: JSON.stringify({
					signingMode: "only_me",
					name: "Ada Lovelace",
					email: "ada@example.com",
					turnstileToken: "test-pass",
				}),
			}),
		);
	});

	it("shows start errors next to the form action", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "TURNSTILE_FAILED",
								message: "Turnstile verification failed",
							},
						}),
						{ status: 403 },
					),
			),
		);

		renderStartEnvelopePage({ testTurnstileToken: "invalid" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Turnstile verification failed");
	});

	it("recovers from non-JSON server failures without leaving the form submitting", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
		);

		renderStartEnvelopePage({ testTurnstileToken: "test-pass" });
		fireEvent.click(screen.getByRole("button", { name: "Sign by myself" }));

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Unable to start the envelope");
		expect(screen.getByRole("button", { name: "Start envelope" })).toBeTruthy();
	});
});
