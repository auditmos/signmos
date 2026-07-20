// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HumanReviewPage } from "./human-review-page";

const reviewId = "c9000000-0000-4000-8000-000000000001";

function renderPage(onNotNow = vi.fn()) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<HumanReviewPage reviewId={reviewId} onNotNow={onNotNow} />
		</QueryClientProvider>,
	);
	return onNotNow;
}

describe("human review page", () => {
	it("shows exact review context with three explicit unselected actions", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							commandId: "d9000000-0000-4000-8000-000000000001",
							reviewId,
							status: "pending_human_review",
							expiresAt: "2026-07-18T10:00:00.000Z",
							document: {
								documentId: "e9000000-0000-4000-8000-000000000001",
								title: "review-me.pdf",
								sourceVersion: 1,
								sourceSha256: "a".repeat(64),
								sourcePdfUrl: `/api/history/human-reviews/${reviewId}/source-pdf`,
								assignedFields: [
									{
										id: "f9000000-0000-4000-8000-000000000001",
										type: "signature",
										page: 1,
										x: 72,
										y: 144,
										width: 180,
										height: 48,
									},
								],
							},
							action: {
								kind: "complete",
								label: "Sign and complete",
								payload:
									'{"rememberSignature":false,"signature":{"kind":"typed","typedFont":"cursive","typedText":"Ada Lovelace"}}',
								consequence: "This will sign the current document and may complete it.",
							},
							agent: { name: "Ada review agent" },
						},
					}),
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const onNotNow = renderPage();

		expect(screen.getByRole("heading", { name: "Review requested action" })).toBeTruthy();
		expect(await screen.findByText("review-me.pdf")).toBeTruthy();
		expect(screen.getByText("Ada review agent")).toBeTruthy();
		expect(screen.getByText("Sign and complete")).toBeTruthy();
		expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
		expect(screen.getByText(/This will sign the current document/)).toBeTruthy();
		expect(screen.getByText(/Expires/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Open current PDF" }).getAttribute("href")).toBe(
			`/api/history/human-reviews/${reviewId}/source-pdf`,
		);
		expect(screen.getByText(/signature field on page 1/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Approve and execute" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Reject request" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Not now" }));
		expect(onNotNow).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("sends an unauthenticated reviewer into passwordless access with the review return path", async () => {
		const recoveryUrl = `/?task=my-documents&returnTo=${encodeURIComponent(`/human-review/${reviewId}`)}`;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "HISTORY_SESSION_REQUIRED",
								message: "Verify the reviewer's email",
								recoveryUrl,
							},
						}),
						{ status: 401 },
					),
			),
		);
		const onVerificationRequired = vi.fn();
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<HumanReviewPage reviewId={reviewId} onVerificationRequired={onVerificationRequired} />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(onVerificationRequired).toHaveBeenCalledWith(recoveryUrl));
	});

	it("announces an approved terminal result and moves keyboard focus to it", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				return new Response(JSON.stringify({ data: { status: "completed" } }));
			}
			return new Response(
				JSON.stringify({
					data: {
						commandId: "d9000000-0000-4000-8000-000000000001",
						reviewId,
						status: "pending_human_review",
						expiresAt: "2026-07-18T10:00:00.000Z",
						document: {
							documentId: "e9000000-0000-4000-8000-000000000001",
							title: "review-me.pdf",
							sourceVersion: 1,
							sourceSha256: "a".repeat(64),
							sourcePdfUrl: "/source.pdf",
							assignedFields: [],
						},
						action: {
							kind: "cancel",
							label: "Cancel document",
							payload: '{"action":"cancel"}',
							consequence: "This will cancel the document.",
						},
						agent: { name: "Review agent" },
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		renderPage();
		fireEvent.click(await screen.findByRole("button", { name: "Approve and execute" }));

		const result = await screen.findByText("Approved and executed.");
		expect(result.getAttribute("aria-live")).toBe("polite");
		expect(document.activeElement).toBe(result);
	});

	it("explains a failed terminal request when revisited after its source is gone", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								commandId: "d9000000-0000-4000-8000-000000000001",
								reviewId,
								status: "failed",
								expiresAt: "2026-07-18T10:00:00.000Z",
								document: {
									documentId: "e9000000-0000-4000-8000-000000000001",
									title: "deleted.pdf",
									sourceVersion: 1,
									sourceSha256: "a".repeat(64),
									sourcePdfUrl: null,
									assignedFields: [],
								},
								action: {
									kind: "delete",
									label: "Delete document",
									payload: '{"action":"delete"}',
									consequence: "This permanently deletes retained files.",
								},
								agent: { name: "Review agent" },
							},
						}),
					),
			),
		);
		renderPage();

		expect(
			await screen.findByText("Approval was recorded, but the requested action failed."),
		).toBeTruthy();
		expect(screen.getByText("The reviewed source PDF is no longer retained.")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Approve and execute" })).toBeNull();
	});
});
