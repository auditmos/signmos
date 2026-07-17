// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SourcePdfUploadPanel } from "./source-pdf-upload-panel";

describe("SourcePdfUploadPanel", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "upload-idempotency-key" });
	});

	it("uploads a PDF with a verified sender session and shows document metadata", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf" &&
				init?.method === "POST"
			) {
				return sourcePdfResponse({ status: 201 });
			}
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfMissingResponse();
			}
			throw new Error(`Unexpected fetch ${String(url)} ${init?.method ?? "GET"}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				signingMode="me_and_another_signer"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		const file = new File([new TextEncoder().encode("%PDF-1.7\n%")], "contract.pdf", {
			type: "application/pdf",
		});
		fireEvent.change(screen.getByLabelText("Choose PDF"), { target: { files: [file] } });
		expect(screen.getByText("contract.pdf")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Upload selected PDF" }));

		await screen.findByText("PDF uploaded");
		expect(screen.getByText(/Version 1/).textContent).toContain("10 bytes");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-type": "application/pdf",
					"idempotency-key": "upload-idempotency-key",
					"x-source-filename": "contract.pdf",
					"x-sender-session-token": "verified-sender-token",
				},
				body: file,
			}),
		);
	});

	it("keeps the single-signer upload step free of partner-recipient fields", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfMissingResponse();
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				signingMode="only_me"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		await screen.findByRole("button", { name: "Select a PDF first" });
		expect(screen.queryByRole("form", { name: "Add recipients" })).toBeNull();
		expect(screen.queryByLabelText("Partner name")).toBeNull();
		expect(screen.queryByLabelText("Partner email")).toBeNull();
	});

	it("shows persisted source PDF metadata after reload", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfResponse({ status: 200 });
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				signingMode="me_and_another_signer"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		await screen.findByText("PDF uploaded");
		expect(screen.getByText(/Version 1/).textContent).toContain("10 bytes");
	});

	it("resolves sender details from the verified sender session before adding recipients", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfResponse({ status: 200 });
			}
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/sender-session") {
				expect(init).toEqual(
					expect.objectContaining({
						headers: { "x-sender-session-token": "verified-sender-token" },
					}),
				);
				return new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							sender: {
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
						},
					}),
					{ status: 200 },
				);
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients" &&
				init?.method !== "POST"
			) {
				return recipientsResponse([]);
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients" &&
				init?.method === "POST"
			) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "20000000-0000-4000-8000-000000000001",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							{
								id: "20000000-0000-4000-8000-000000000002",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								name: "Grace Hopper",
								email: "grace@example.com",
							},
						],
					}),
					{ status: 201 },
				);
			}
			throw new Error(`Unexpected fetch ${String(url)} ${init?.method ?? "GET"}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
			/>,
		);

		await screen.findByText("Ada Lovelace");
		expect(screen.getByText("ada@example.com")).toBeDefined();
		expect(screen.queryByLabelText("Sender name")).toBeNull();
		expect(screen.queryByLabelText("Sender email")).toBeNull();
		fireEvent.change(screen.getByLabelText("Partner name"), { target: { value: "Grace Hopper" } });
		fireEvent.change(screen.getByLabelText("Partner email"), {
			target: { value: "grace@example.com" },
		});
		const addButton = screen.getByRole("button", { name: "Add recipients" });
		await waitFor(() => expect(addButton.hasAttribute("disabled")).toBe(false));
		fireEvent.click(addButton);

		await screen.findByText("Recipients added");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					recipients: [
						{ name: "Ada Lovelace", email: "ada@example.com" },
						{ name: "Grace Hopper", email: "grace@example.com" },
					],
				}),
			}),
		);
	});

	it("adds recipients and links to field preparation for the same envelope", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfResponse({ status: 200 });
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients" &&
				init?.method !== "POST"
			) {
				return recipientsResponse([]);
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients" &&
				init?.method === "POST"
			) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "20000000-0000-4000-8000-000000000001",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							{
								id: "20000000-0000-4000-8000-000000000002",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								name: "Grace Hopper",
								email: "grace@example.com",
							},
						],
					}),
					{ status: 201 },
				);
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				signingMode="me_and_another_signer"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		await screen.findByText("PDF uploaded");
		expect(screen.queryByLabelText("Sender name")).toBeNull();
		expect(screen.queryByLabelText("Sender email")).toBeNull();
		expect(screen.getByText("Ada Lovelace")).toBeDefined();
		expect(screen.getByText("ada@example.com")).toBeDefined();
		fireEvent.change(screen.getByLabelText("Partner name"), { target: { value: "Grace Hopper" } });
		fireEvent.change(screen.getByLabelText("Partner email"), {
			target: { value: "grace@example.com" },
		});
		const addButton = screen.getByRole("button", { name: "Add recipients" });
		await waitFor(() => expect(addButton.hasAttribute("disabled")).toBe(false));
		fireEvent.click(addButton);

		await screen.findByText("Recipients added");
		const link = screen.getByRole("link", { name: /Continue to prepare fields/ });
		expect(link.getAttribute("href")).toBe(
			"/envelope-fields?envelopeId=00000000-0000-4000-8000-000000000001&recipientId=20000000-0000-4000-8000-000000000001&name=Ada+Lovelace&email=ada%40example.com&partnerRecipientId=20000000-0000-4000-8000-000000000002&partnerName=Grace+Hopper&partnerEmail=grace%40example.com&senderSessionToken=verified-sender-token",
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-sender-session-token": "verified-sender-token",
				},
				body: JSON.stringify({
					recipients: [
						{ name: "Ada Lovelace", email: "ada@example.com" },
						{ name: "Grace Hopper", email: "grace@example.com" },
					],
				}),
			}),
		);
	});

	it("blocks recipient creation until the source PDF is persisted", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfMissingResponse();
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		await screen.findByText("Source PDF required");
		const addButton = screen.getByRole("button", { name: "Add recipients" });
		expect(addButton.hasAttribute("disabled")).toBe(true);
		fireEvent.click(addButton);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			expect.anything(),
		);
	});

	it("shows actionable upload validation errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
				if (
					url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf" &&
					init?.method !== "POST"
				) {
					return sourcePdfMissingResponse();
				}
				return new Response(
					JSON.stringify({
						error: {
							code: "INVALID_SOURCE_PDF",
							message: "Source document must be a PDF",
						},
					}),
					{ status: 400 },
				);
			}),
		);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		const file = new File(["not a pdf"], "contract.pdf", { type: "application/pdf" });
		fireEvent.change(screen.getByLabelText("Choose PDF"), { target: { files: [file] } });
		fireEvent.click(screen.getByRole("button", { name: "Upload selected PDF" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Source document must be a PDF");
	});

	it("keeps upload disabled until a PDF is selected", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfMissingResponse();
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		const uploadButton = screen.getByRole("button", { name: "Select a PDF first" });
		expect(uploadButton.hasAttribute("disabled")).toBe(true);
		fireEvent.click(uploadButton);
		expect(screen.queryByText("Choose a PDF before uploading")).toBeNull();
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			expect.objectContaining({ method: "POST" }),
		);

		const file = new File([new TextEncoder().encode("%PDF-1.7\n%")], "contract.pdf", {
			type: "application/pdf",
		});
		fireEvent.change(screen.getByLabelText("Choose PDF"), { target: { files: [file] } });

		const selectedButton = screen.getByRole("button", { name: "Upload selected PDF" });
		expect(selectedButton.hasAttribute("disabled")).toBe(false);
	});

	it("rejects non-PDF files before upload", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfMissingResponse();
			}
			throw new Error(`Unexpected fetch ${String(url)}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
				senderName="Ada Lovelace"
				senderEmail="ada@example.com"
			/>,
		);

		const file = new File(["not a pdf"], "contract.txt", { type: "text/plain" });
		fireEvent.change(screen.getByLabelText("Choose PDF"), { target: { files: [file] } });

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Select a PDF file");
		expect(
			screen.getByRole("button", { name: "Select a PDF first" }).hasAttribute("disabled"),
		).toBe(true);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			expect.objectContaining({ method: "POST" }),
		);
	});
});

function sourcePdfResponse({ status }: { status: number }) {
	return new Response(
		JSON.stringify({
			data: {
				id: "10000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				r2Key: "envelopes/00000000-0000-4000-8000-000000000001/source-v1.pdf",
				version: 1,
				sha256: "a".repeat(64),
				byteSize: 10,
				contentType: "application/pdf",
				uploadedBy: "ada@example.com",
				uploadedAt: "2026-05-21T09:10:00.000Z",
			},
		}),
		{ status },
	);
}

function sourcePdfMissingResponse() {
	return new Response(
		JSON.stringify({
			error: {
				code: "SOURCE_PDF_NOT_FOUND",
				message: "Upload a source PDF before preparing or sending this envelope",
			},
		}),
		{ status: 404 },
	);
}

function recipientsResponse(recipients: unknown[]) {
	return new Response(JSON.stringify({ data: recipients }), { status: 200 });
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
