// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { EnvelopePreparationPage } from "./envelope-preparation-page";

const reviewEnvelopeId = "00000000-0000-4000-8000-000000000001";
const reviewUserId = "ui-user";

describe("EnvelopePreparationPage", () => {
	it("creates a real review envelope before enabling signature saves from the default route", async () => {
		const fetchMock = createReviewEnvelopeFetchMock();
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(<EnvelopePreparationPage />);

		expect(screen.queryByText("Signature profile")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Create review envelope" }));

		await screen.findByText("Signature preference");
		fireEvent.change(await screen.findByLabelText("Typed signature text"), {
			target: { value: "Ada Lovelace" },
		});
		fireEvent.change(screen.getByLabelText("Preference name"), {
			target: { value: "Ada typed" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save signature preference" }));

		await screen.findByText("Ada typed selected");
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						kind: "typed",
						label: "Ada typed",
						typedText: "Ada Lovelace",
						typedFont: "cursive",
						selected: true,
					}),
				}),
			),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			expect.objectContaining({
				headers: {
					"Content-Type": "application/json",
					"x-internal-user-id": "ui-user",
				},
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					kind: "typed",
					label: "Ada typed",
					typedText: "Ada Lovelace",
					typedFont: "cursive",
					selected: true,
				}),
			}),
		);
	});

	it("blocks send and links back to upload when source PDF metadata is missing", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return new Response(
					JSON.stringify({
						error: {
							code: "SOURCE_PDF_NOT_FOUND",
							message: "Upload a source PDF before preparing or sending this envelope",
							allowedActions: ["upload_source_pdf"],
						},
					}),
					{ status: 404 },
				);
			}
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/actions") {
				throw new Error(`Send should be blocked before POST ${init?.method ?? "GET"}`);
			}
			return new Response(JSON.stringify({ error: { code: "UNEXPECTED" } }), { status: 500 });
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<EnvelopePreparationPage
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				recipients={[
					{
						id: "20000000-0000-4000-8000-000000000001",
						name: "Ada Lovelace",
						email: "ada@example.com",
					},
					{
						id: "20000000-0000-4000-8000-000000000002",
						name: "Grace Hopper",
						email: "grace@example.com",
					},
				]}
			/>,
		);

		await screen.findByText("Source PDF required");
		expect(
			screen.getByText("Upload a source PDF before preparing or sending this envelope"),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Upload PDF" }).getAttribute("href")).toBe(
			"/source-pdf-upload?envelopeId=00000000-0000-4000-8000-000000000001&senderSessionToken=verified-sender-token",
		);
		const sendButton = screen.getByRole("button", { name: "Send envelope" });
		expect(sendButton.hasAttribute("disabled")).toBe(true);
		fireEvent.click(sendButton);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/actions",
			expect.anything(),
		);
	});
});

function createReviewEnvelopeFetchMock() {
	const responses: Record<string, () => Response> = {
		"/api/envelopes": () =>
			jsonResponse(
				{
					data: {
						id: reviewEnvelopeId,
						status: "draft",
						createdBy: reviewUserId,
						createdAt: "2026-05-21T09:00:00.000Z",
					},
				},
				201,
			),
		[`/api/envelopes/${reviewEnvelopeId}/recipients`]: () =>
			jsonResponse(
				{
					data: [
						{
							id: "20000000-0000-4000-8000-000000000001",
							name: "Ada Lovelace",
							email: "ada@example.com",
						},
						{
							id: "20000000-0000-4000-8000-000000000002",
							name: "Grace Hopper",
							email: "grace@example.com",
						},
					],
				},
				201,
			),
		[`/api/envelopes/${reviewEnvelopeId}/signature-profiles`]: () =>
			jsonResponse(
				{
					data: {
						id: "60000000-0000-4000-8000-000000000001",
						label: "Ada typed",
					},
				},
				201,
			),
		[`/api/envelopes/${reviewEnvelopeId}/signature-profiles/selected`]: () =>
			jsonResponse({ data: null }),
		[`/api/envelopes/${reviewEnvelopeId}/fields`]: () => jsonResponse({ data: [] }),
		[`/api/envelopes/${reviewEnvelopeId}/source-pdf`]: () =>
			jsonResponse({
				data: {
					id: "10000000-0000-4000-8000-000000000001",
					envelopeId: reviewEnvelopeId,
					r2Key: `envelopes/${reviewEnvelopeId}/source-v1.pdf`,
					version: 1,
					sha256: "a".repeat(64),
					byteSize: 10,
					contentType: "application/pdf",
					uploadedBy: reviewUserId,
					uploadedAt: "2026-05-21T09:10:00.000Z",
				},
			}),
	};
	return vi.fn(async (input: RequestInfo | URL) => {
		const response = responses[String(input)];
		return response ? response() : jsonResponse({ error: { code: "UNEXPECTED" } }, 500);
	});
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

function renderWithQueryClient(ui: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
