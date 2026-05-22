// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StartEnvelopePage } from "./start-envelope-page";

describe("StartEnvelopePage", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "form-idempotency-key" });
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
