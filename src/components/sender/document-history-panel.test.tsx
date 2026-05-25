// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { DocumentHistoryPanel } from "./document-history-panel";

describe("DocumentHistoryPanel", () => {
	it("loads confirmed-email history, filters by state, and exposes completed and resume actions", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			expect(url).toBe("/api/envelopes/00000000-0000-4000-8000-000000000001/history");
			expect(init).toEqual(
				expect.objectContaining({
					headers: { "x-sender-session-token": "verified-sender-token" },
				}),
			);
			return new Response(
				JSON.stringify({
					data: {
						email: "ada@example.com",
						windowStart: "2026-04-21T09:00:00.000Z",
						windowDays: 30,
						documents: [
							{
								envelopeId: "00000000-0000-4000-8000-000000000001",
								createdAt: "2026-05-21T09:00:00.000Z",
								status: "draft",
								state: "draft",
								documentType: "self_signed",
								role: "creator",
								title: "Document 00000000",
								action: {
									type: "resume",
									label: "Resume draft",
									url: "/source-pdf-upload?envelopeId=00000000-0000-4000-8000-000000000001&senderSessionToken=verified-sender-token",
								},
								creatorActions: [{ action: "delete", label: "Delete" }],
							},
							{
								envelopeId: "00000000-0000-4000-8000-000000000002",
								createdAt: "2026-05-20T09:00:00.000Z",
								status: "sent",
								state: "in_progress",
								documentType: "signed_with_partner",
								role: "signer",
								title: "Document 00000000",
								action: {
									type: "resume",
									label: "Resume signing",
									url: "/signing/sent-signer-token",
								},
								creatorActions: [],
							},
							{
								envelopeId: "00000000-0000-4000-8000-000000000003",
								createdAt: "2026-05-19T09:00:00.000Z",
								status: "completed",
								state: "completed",
								documentType: "self_signed",
								role: "creator_and_signer",
								title: "Document 00000000",
								action: {
									type: "completed",
									label: "View completed",
									url: "/completed-documents/completed-signer-token",
									downloadUrl: "/api/final-documents/completed-signer-token/pdf",
								},
								creatorActions: [{ action: "delete", label: "Delete" }],
							},
						],
					},
				}),
				{ status: 200 },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<DocumentHistoryPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Show document history" }));

		const table = await screen.findByRole("table", {
			name: "Confirmed email document history",
		});
		expect(within(table).getAllByText("Self-signed").length).toBeGreaterThan(0);
		expect(within(table).getByText("Signed with partner")).toBeTruthy();
		expect(screen.getByRole("link", { name: "View completed" }).getAttribute("href")).toBe(
			"/completed-documents/completed-signer-token",
		);
		expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(
			"/api/final-documents/completed-signer-token/pdf",
		);
		expect(screen.getByRole("link", { name: "Resume draft" }).getAttribute("href")).toBe(
			"/source-pdf-upload?envelopeId=00000000-0000-4000-8000-000000000001&senderSessionToken=verified-sender-token",
		);
		expect(screen.getByRole("link", { name: "Resume signing" }).getAttribute("href")).toBe(
			"/signing/sent-signer-token",
		);

		fireEvent.change(screen.getByLabelText("Filter document history by state"), {
			target: { value: "completed" },
		});

		expect(screen.getByText("completed")).toBeTruthy();
		expect(screen.queryByText("sent")).toBeNull();
		expect(screen.queryByText("draft")).toBeNull();
	});

	it("shows creator-only lifecycle controls and invokes existing envelope actions", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000010/history" && !init?.method) {
				return historyResponse([
					historyDocument({
						envelopeId: "00000000-0000-4000-8000-000000000011",
						title: "Creator sent",
						status: "sent",
						state: "in_progress",
						role: "creator",
						creatorActions: [
							{ action: "cancel", label: "Cancel" },
							{ action: "delete", label: "Delete" },
						],
					}),
					historyDocument({
						envelopeId: "00000000-0000-4000-8000-000000000012",
						title: "Partner sent",
						status: "sent",
						state: "in_progress",
						role: "signer",
						creatorActions: [],
					}),
					historyDocument({
						envelopeId: "00000000-0000-4000-8000-000000000013",
						title: "Completed creator",
						status: "completed",
						state: "completed",
						role: "creator",
						action: {
							type: "completed",
							label: "View completed",
							url: "/completed-documents/completed-token",
							downloadUrl: "/api/final-documents/completed-token/pdf",
						},
						creatorActions: [{ action: "delete", label: "Delete" }],
					}),
				]);
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000011/actions" &&
				init?.method === "POST"
			) {
				expect(init).toEqual(
					expect.objectContaining({
						headers: {
							"content-type": "application/json",
							"x-sender-session-token": "verified-sender-token",
						},
						body: JSON.stringify({ action: "cancel" }),
					}),
				);
				return new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000011",
							action: "cancel",
							status: "expired",
							allowedActions: ["delete"],
						},
					}),
					{ status: 200 },
				);
			}
			throw new Error(`Unexpected fetch ${String(url)} ${init?.method ?? "GET"}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<DocumentHistoryPanel
				envelopeId="00000000-0000-4000-8000-000000000010"
				senderSessionToken="verified-sender-token"
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Show document history" }));

		await screen.findByText("Creator sent");
		expect(screen.getByRole("button", { name: "Cancel Creator sent" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Delete Creator sent" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Cancel Partner sent" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Delete Partner sent" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Cancel Completed creator" })).toBeNull();
		expect(screen.getByRole("button", { name: "Delete Completed creator" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Cancel Creator sent" }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/envelopes/00000000-0000-4000-8000-000000000011/actions",
				expect.objectContaining({ method: "POST" }),
			);
		});
	});
});

function renderWithQueryClient(element: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function historyResponse(documents: unknown[]) {
	return new Response(
		JSON.stringify({
			data: {
				email: "ada@example.com",
				windowStart: "2026-04-21T09:00:00.000Z",
				windowDays: 30,
				documents,
			},
		}),
		{ status: 200 },
	);
}

function historyDocument(overrides: {
	envelopeId: string;
	title: string;
	status: string;
	state: "draft" | "in_progress" | "completed";
	role: string;
	action?: {
		type: "resume" | "completed";
		label: string;
		url: string;
		downloadUrl?: string;
	} | null;
	creatorActions: Array<{ action: string; label: string }>;
}) {
	return {
		createdAt: "2026-05-21T09:00:00.000Z",
		documentType: "self_signed",
		action: {
			type: "resume",
			label: "Resume signing",
			url: "/signing/sent-signer-token",
		},
		...overrides,
	};
}
