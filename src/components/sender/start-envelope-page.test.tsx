// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StartEnvelopePage } from "./start-envelope-page";

describe("StartEnvelopePage", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "form-idempotency-key" });
	});

	it("blocks sender start when Turnstile is not configured", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		render(<StartEnvelopePage />);

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

		render(<StartEnvelopePage turnstileSiteKey="site-key" />);

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

		render(<StartEnvelopePage turnstileSiteKey="site-key" />);

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

		render(<StartEnvelopePage turnstileSiteKey="site-key" />);

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

		render(<StartEnvelopePage testTurnstileToken="test-pass" />);

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

		render(<StartEnvelopePage testTurnstileToken="invalid" />);

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

		render(<StartEnvelopePage testTurnstileToken="test-pass" />);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Start envelope" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Unable to start the envelope");
		expect(screen.getByRole("button", { name: "Start envelope" })).toBeTruthy();
	});
});
