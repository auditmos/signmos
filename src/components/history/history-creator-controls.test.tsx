// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { HistoryCreatorPage } from "./history-creator-page";
import { HistoryDocumentsPage } from "./history-documents-page";

const envelopeId = "00000000-0000-4000-8000-000000000041";

function renderWithQuery(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function catalogItem(status = "sent", actions = ["review", "cancel", "delete"]) {
	return {
		envelopeId,
		title: "Creator contract.pdf",
		shortReference: "A1B2C3D4",
		status,
		group: status === "sent" ? "waiting_on_others" : "closed",
		role: "creator",
		participants: [],
		allowedActions: actions,
		createdAt: "2026-07-16T08:00:00.000Z",
		activityAt: "2026-07-16T09:00:00.000Z",
		detailUrl: null,
		downloadUrl: null,
	};
}

function catalogResponse(items: unknown[]) {
	return new Response(
		JSON.stringify({
			data: {
				items,
				pagination: { page: 1, pageSize: 25, totalItems: items.length, totalPages: 1 },
			},
		}),
	);
}

describe("history creator controls", () => {
	it("uses distinct accessible dialogs and invokes cancel/delete exactly once", async () => {
		// Issue #41 assumptions before RED:
		// - Radix Dialog supplies focus trap, Escape cancellation, and trigger focus restoration.
		// - Mutation success invalidates the catalog; server data decides the next available actions.
		let state: "sent" | "expired" | "deleted" = "sent";
		const actionCalls: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/creator-actions")) {
				const action = (JSON.parse(String(init?.body)) as { action: "cancel" | "delete" }).action;
				actionCalls.push(action);
				state = action === "cancel" ? "expired" : "deleted";
				return new Response(JSON.stringify({ data: { status: state } }));
			}
			if (state === "sent") return catalogResponse([catalogItem()]);
			if (state === "expired") return catalogResponse([catalogItem("expired", ["delete"])]);
			return catalogResponse([]);
		});
		vi.stubGlobal("fetch", fetchMock);
		renderWithQuery(<HistoryDocumentsPage />);

		expect(await screen.findByRole("link", { name: "Review status" })).toHaveProperty(
			"href",
			`http://localhost:3000/my-documents/${envelopeId}/manage`,
		);
		const cancelTrigger = screen.getByRole("button", { name: "Cancel Creator contract.pdf" });
		cancelTrigger.focus();
		fireEvent.click(cancelTrigger);
		const cancelDialog = await screen.findByRole("dialog", { name: "Cancel document?" });
		expect(cancelDialog.textContent).toContain("stops outstanding signing access");
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.activeElement).toBe(cancelTrigger);

		fireEvent.click(cancelTrigger);
		fireEvent.click(await screen.findByRole("button", { name: "Confirm cancel" }));
		await waitFor(() => expect(actionCalls).toEqual(["cancel"]));
		const deleteTrigger = await screen.findByRole("button", {
			name: "Delete Creator contract.pdf",
		});
		fireEvent.click(deleteTrigger);
		const deleteDialog = await screen.findByRole("dialog", { name: "Delete document?" });
		expect(deleteDialog.textContent).toContain("permanently removes stored PDFs");
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
		await waitFor(() => expect(actionCalls).toEqual(["cancel", "delete"]));
		await screen.findByText("No documents match these filters.");
	});

	it("resumes draft preparation through history access without a sender token", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/creator")) {
				return new Response(
					JSON.stringify({
						data: {
							envelopeId,
							status: "draft",
							signingMode: "me_and_another_signer",
							sender: { name: "Ada Creator", email: "creator@example.com" },
							allowedActions: ["resume"],
							resumeUrl: `/my-documents/${envelopeId}/manage`,
						},
					}),
				);
			}
			if (url.endsWith("/source-pdf")) {
				return new Response(
					JSON.stringify({
						data: {
							id: "source-41",
							envelopeId,
							r2Key: "source.pdf",
							version: 1,
							sha256: "a".repeat(64),
							byteSize: 20,
							contentType: "application/pdf",
							originalFilename: "Creator contract.pdf",
							uploadedBy: "creator@example.com",
							uploadedAt: "2026-07-16T08:03:00.000Z",
						},
					}),
				);
			}
			if (url.endsWith("/recipients")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "sender-41",
								envelopeId,
								name: "Ada Creator",
								email: "creator@example.com",
							},
							{
								id: "partner-41",
								envelopeId,
								name: "Grace Signer",
								email: "signer@example.com",
							},
						],
					}),
				);
			}
			throw new Error(`Unexpected request ${url} ${String(init?.method)}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		renderWithQuery(<HistoryCreatorPage envelopeId={envelopeId} />);

		expect(await screen.findByRole("heading", { name: "Resume document" })).toBeTruthy();
		expect(await screen.findByRole("form", { name: "Upload source PDF" })).toBeTruthy();
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				`/api/envelopes/${envelopeId}/source-pdf`,
				expect.objectContaining({
					headers: expect.objectContaining({ "x-history-session-access": "true" }),
				}),
			),
		);
		const prepareLink = await screen.findByRole("link", { name: "Continue to prepare fields" });
		expect(prepareLink.getAttribute("href")).toContain("historyAccess=true");
		expect(prepareLink.getAttribute("href")).not.toContain("senderSessionToken");
		expect(document.body.textContent).not.toContain("sender-token");
		expect(fetchMock.mock.calls.map(([input]) => String(input)).join(" ")).not.toContain(
			"senderSessionToken",
		);
	});
});
