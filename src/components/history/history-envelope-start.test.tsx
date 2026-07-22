// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoryEnvelopeStart } from "./history-envelope-start";

describe("HistoryEnvelopeStart", () => {
	it("opens with a navigation-selected signing mode and keeps the verified session path", async () => {
		// Primary-navigation assumptions before RED:
		// - Choosing a signing mode from the shared menu opens this form immediately.
		// - The selected mode is explicit and can still be changed before submission.
		// - The verified email remains session-owned, so no email or Turnstile input reappears.
		vi.stubGlobal("crypto", { randomUUID: () => "navigation-start-idempotency-key" });
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000044",
							status: "draft",
							signingMode: "only_me",
							sender: { name: "Ada Lovelace", email: "owner@example.com" },
							redirectUrl: "/my-documents/00000000-0000-4000-8000-000000000044/manage",
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryEnvelopeStart
					identity={{ email: "owner@example.com", suggestedName: "Ada Lovelace" }}
					initialSigningMode="only_me"
					onStarted={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		expect(screen.getByRole("form", { name: "Start a new document" })).toBeTruthy();
		expect((screen.getByLabelText("Sign by myself") as HTMLInputElement).checked).toBe(true);
		expect(screen.queryByLabelText("Email")).toBeNull();
		expect(screen.queryByText(/Turnstile/i)).toBeNull();

		fireEvent.submit(screen.getByRole("form", { name: "Start a new document" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/history/envelopes",
			expect.objectContaining({
				body: JSON.stringify({ name: "Ada Lovelace", signingMode: "only_me" }),
			}),
		);
	});

	it("prefills an editable recent name and starts either signing mode without email verification", async () => {
		// Approved UI assumptions before RED:
		// - The start form is collapsed until an explicit button click.
		// - The verified email is displayed but never editable or submitted by the browser.
		// - The recent name is editable and neither signing mode is silently preselected.
		// - Success enters the existing history-session preparation route.
		vi.stubGlobal("crypto", { randomUUID: () => "history-start-idempotency-key" });
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000043",
							status: "draft",
							signingMode: "me_and_another_signer",
							sender: { name: "Ada Updated", email: "owner@example.com" },
							redirectUrl: "/my-documents/00000000-0000-4000-8000-000000000043/manage",
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const onStarted = vi.fn();
		const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<HistoryEnvelopeStart
					identity={{ email: "owner@example.com", suggestedName: "Ada Lovelace" }}
					onStarted={onStarted}
				/>
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Start a new document" }));
		expect(screen.getByLabelText("Your verified email").textContent).toBe("owner@example.com");
		const name = screen.getByLabelText("Your name") as HTMLInputElement;
		expect(name.value).toBe("Ada Lovelace");
		expect(screen.queryByLabelText("Email")).toBeNull();
		expect(screen.queryByText(/Turnstile/i)).toBeNull();

		fireEvent.change(name, { target: { value: "Ada Updated" } });
		fireEvent.click(screen.getByLabelText("Sign with someone else"));
		fireEvent.submit(screen.getByRole("form", { name: "Start a new document" }));

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith("/api/history/envelopes", {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "history-start-idempotency-key",
				},
				body: JSON.stringify({
					name: "Ada Updated",
					signingMode: "me_and_another_signer",
				}),
			}),
		);
		expect(onStarted).toHaveBeenCalledWith(
			"/my-documents/00000000-0000-4000-8000-000000000043/manage",
		);
		expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/(?:token|turnstile)/i);
	});
});
