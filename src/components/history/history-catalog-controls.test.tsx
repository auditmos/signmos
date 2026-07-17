// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoryDocumentsPage } from "./history-documents-page";

function renderCatalog() {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<HistoryDocumentsPage />
		</QueryClientProvider>,
	);
}

function catalogResponse(page = 1, items: unknown[] = [catalogItem()]) {
	return new Response(
		JSON.stringify({
			data: {
				items,
				pagination: { page, pageSize: 25, totalItems: 26, totalPages: 2 },
			},
		}),
	);
}

function catalogItem() {
	return {
		envelopeId: "00000000-0000-4000-8000-000000000001",
		title: "Contract.pdf",
		shortReference: "A1B2C3D4",
		status: "sent",
		group: "needs_my_action",
		role: "signer",
		participants: [
			{ name: "Ada Lovelace", email: "ada@example.com", role: "creator" },
			{ name: "Grace Hopper", email: "grace@example.com", role: "signer" },
		],
		allowedActions: ["sign"],
		createdAt: "2026-07-16T08:00:00.000Z",
		activityAt: "2026-07-16T09:00:00.000Z",
		detailUrl: null,
		downloadUrl: null,
	};
}

describe("full history catalog controls", () => {
	it("renders retention, exact row labels, authorized controls, and numbered pagination", async () => {
		// Issue #39 assumptions before RED:
		// - TanStack Form owns the four filter fields; Query owns each submitted page.
		// - Group and status remain distinct visible labels.
		// - Native labelled controls and numbered buttons are keyboard-operable without pointer logic.
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			return catalogResponse(Number(url.searchParams.get("page") ?? "1"));
		});
		vi.stubGlobal("fetch", fetchMock);
		renderCatalog();

		expect(await screen.findByRole("heading", { name: "My documents" })).toBeTruthy();
		const retention = screen.getByText(/retained for 90 days/i);
		expect(retention.textContent).toMatch(/not permanent storage/i);
		expect(await screen.findByRole("heading", { name: "Contract.pdf" })).toBeTruthy();
		expect(screen.getByText("Needs my action")).toBeTruthy();
		expect(screen.getByText("Sent")).toBeTruthy();
		expect(screen.getByText(/A1B2C3D4/)).toBeTruthy();
		expect(screen.getByText(/Grace Hopper/).textContent).toContain("grace@example.com");
		expect(screen.getByRole("link", { name: "Review and sign" }).getAttribute("href")).toBe(
			"/my-documents/00000000-0000-4000-8000-000000000001/sign",
		);

		fireEvent.change(screen.getByLabelText("Search documents"), {
			target: { value: " Contract " },
		});
		fireEvent.change(screen.getByLabelText("Role"), { target: { value: "signer" } });
		fireEvent.change(screen.getByLabelText("Group"), {
			target: { value: "needs_my_action" },
		});
		fireEvent.change(screen.getByLabelText("Status"), { target: { value: "sent" } });
		fireEvent.submit(screen.getByRole("form", { name: "Filter My documents" }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenLastCalledWith(
				"/api/history/documents?search=Contract&role=signer&group=needs_my_action&status=sent&page=1",
				{ credentials: "same-origin" },
			);
		});
		const pageOne = await screen.findByRole("button", { name: "Page 1" });
		expect(pageOne.getAttribute("aria-current")).toBe("page");
		fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenLastCalledWith(
				"/api/history/documents?search=Contract&role=signer&group=needs_my_action&status=sent&page=2",
				{ credentials: "same-origin" },
			),
		);
		expect(await screen.findByRole("navigation", { name: "Catalog pages" })).toBeTruthy();
	});

	it("announces loading and empty results", async () => {
		let resolveRequest: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						resolveRequest = resolve;
					}),
			),
		);
		renderCatalog();

		expect(screen.getByRole("status").textContent).toContain("Loading your documents");
		resolveRequest?.(catalogResponse(1, []));
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toContain("No documents match these filters"),
		);
	});

	it("announces catalog errors without removing the labelled controls", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("failure", { status: 500 })),
		);
		renderCatalog();

		expect((await screen.findByRole("alert")).textContent).toContain("Unable to load My documents");
		expect(screen.getByLabelText("Search documents")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Apply filters" })).toBeTruthy();
	});
});
