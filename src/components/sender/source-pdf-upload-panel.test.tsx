// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SourcePdfUploadPanel } from "./source-pdf-upload-panel";

describe("SourcePdfUploadPanel", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "upload-idempotency-key" });
	});

	it("uploads a PDF with a verified sender session and shows document metadata", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
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
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
			/>,
		);

		const file = new File([new TextEncoder().encode("%PDF-1.7\n%")], "contract.pdf", {
			type: "application/pdf",
		});
		fireEvent.change(screen.getByLabelText("Source PDF"), { target: { files: [file] } });
		fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));

		await screen.findByText("PDF uploaded");
		expect(screen.getByText(/Version 1/).textContent).toContain("10 bytes");
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-type": "application/pdf",
					"idempotency-key": "upload-idempotency-key",
					"x-sender-session-token": "verified-sender-token",
				},
				body: file,
			}),
		);
	});

	it("shows actionable upload validation errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "INVALID_SOURCE_PDF",
								message: "Source document must be a PDF",
							},
						}),
						{ status: 400 },
					),
			),
		);

		render(
			<SourcePdfUploadPanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
			/>,
		);

		const file = new File(["not a pdf"], "contract.txt", { type: "text/plain" });
		fireEvent.change(screen.getByLabelText("Source PDF"), { target: { files: [file] } });
		fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("Source document must be a PDF");
	});
});
