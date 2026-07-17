// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { StartEnvelopePage } from "@/components/sender/start-envelope-page";

function renderRequestPage(props: ComponentProps<typeof StartEnvelopePage> = {}) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<StartEnvelopePage {...props} />
		</QueryClientProvider>,
	);
}

function openHistoryRequest() {
	fireEvent.click(screen.getByRole("button", { name: "My documents" }));
}

describe("history access request form", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "history-request-key" });
	});

	it.each([
		"",
		"   ",
		"not-an-email",
	])("rejects %j with a labelled field error before submission", async (email) => {
		// Issue #38 assumptions before RED:
		// - TanStack Form owns validation instead of relying on browser constraint UI.
		// - Empty, normalized-empty, and malformed values share one accessible field error.
		// - Invalid input never reaches the request boundary.
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		renderRequestPage({ testTurnstileToken: "test-pass" });
		openHistoryRequest();

		const input = screen.getByLabelText("Email");
		fireEvent.change(input, { target: { value: email } });
		fireEvent.submit(screen.getByRole("form", { name: "Request My documents access" }));

		const error = await screen.findByRole("alert");
		expect(error.textContent).toContain("Enter a valid email address");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe(error.id);
		expect(document.activeElement).toBe(input);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("requires configured Turnstile before a history request can be submitted", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		renderRequestPage();
		openHistoryRequest();

		expect(screen.getByRole("alert").textContent).toContain("Turnstile is not configured");
		expect(
			(screen.getByRole("button", { name: "Email me a secure link" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("can open with My documents preselected for recovery links", () => {
		renderRequestPage({ initialTask: "my_documents", testTurnstileToken: "test-pass" });

		expect(screen.getByRole("form", { name: "Request My documents access" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "My documents" })).toBeNull();
	});

	it("submits email plus Turnstile and announces privacy-safe accepted guidance", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ data: { status: "accepted" } }), { status: 202 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderRequestPage({ testTurnstileToken: "test-pass" });
		openHistoryRequest();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: " Owner@Example.com " },
		});
		fireEvent.submit(screen.getByRole("form", { name: "Request My documents access" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/history/access-requests",
			expect.objectContaining({
				headers: {
					"content-type": "application/json",
					"idempotency-key": "history-request-key",
				},
				body: JSON.stringify({
					email: "Owner@Example.com",
					turnstileToken: "test-pass",
				}),
			}),
		);
		const accepted = await screen.findByRole("status");
		expect(document.activeElement).toBe(accepted);
		expect(accepted.textContent).toContain("Check the spelling");
		expect(accepted.textContent).toContain("spam");
		expect(accepted.textContent).toContain("another email address");
		expect(accepted.textContent).toContain("90 days");
		expect(accepted.textContent).not.toMatch(/found|matched|documents? exist/i);
	});

	it("rotates the idempotency key only after an accepted request", async () => {
		const randomUUID = vi
			.fn()
			.mockReturnValueOnce("sender-key")
			.mockReturnValueOnce("deliberate-key-1")
			.mockReturnValueOnce("deliberate-key-2");
		vi.stubGlobal("crypto", { randomUUID });
		const fetchMock = vi.fn<typeof fetch>(
			async (_input, _init) =>
				new Response(JSON.stringify({ data: { status: "accepted" } }), { status: 202 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderRequestPage({ testTurnstileToken: "test-pass" });
		openHistoryRequest();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "owner@example.com" },
		});
		const form = screen.getByRole("form", { name: "Request My documents access" });

		fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls.map((call) => call[1]?.headers)).toEqual([
			{
				"content-type": "application/json",
				"idempotency-key": "deliberate-key-1",
			},
			{
				"content-type": "application/json",
				"idempotency-key": "deliberate-key-2",
			},
		]);
	});
});
