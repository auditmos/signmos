// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { ManualSigningSmokePage } from "./manual-smoke-page";

describe("ManualSigningSmokePage", () => {
	it("drives the full signing workflow from browser controls", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							id: "00000000-0000-4000-8000-000000000001",
							status: "draft",
							createdBy: "manual-ui",
							createdAt: "2026-05-20T10:00:00.000Z",
						},
					}),
					{ status: 201 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 201 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: [
							{
								id: "20000000-0000-4000-8000-000000000001",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								name: "Ada Lovelace",
								email: "ada@example.com",
								status: "pending",
								createdAt: "2026-05-20T10:01:00.000Z",
							},
						],
					}),
					{ status: 201 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 201 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "sent",
							sentBy: "manual-ui",
							tokenCount: 1,
							emailSendCount: 1,
							verificationLinks: [
								{
									recipientId: "20000000-0000-4000-8000-000000000001",
									email: "ada@example.com",
									token: "valid-token",
									url: "/api/signing/verifications/valid-token",
									expiresAt: "2026-05-27T10:00:00.000Z",
								},
							],
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							status: "verified",
							signingLink: { token: "valid-token", url: "/signing/valid-token" },
							verifiedAt: "2026-05-20T10:05:00.000Z",
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "completed",
							finalPdfAvailable: true,
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							completedDocument: {
								url: "/completed-documents/90000000-0000-4000-8000-000000000001",
								downloadUrl: "/api/final-documents/90000000-0000-4000-8000-000000000001/pdf",
							},
						},
					}),
					{ status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		render(<ManualSigningSmokePage />);

		fireEvent.click(screen.getByRole("button", { name: "Run setup" }));

		await screen.findByRole("link", { name: "/api/signing/verifications/valid-token" });
		fireEvent.click(screen.getByRole("button", { name: "Verify partner" }));
		await screen.findByRole("link", { name: "/signing/valid-token" });
		fireEvent.change(screen.getByLabelText("Typed signature"), {
			target: { value: "Ada Lovelace" },
		});
		fireEvent.change(screen.getByLabelText("Signing date"), { target: { value: "2026-05-20" } });
		fireEvent.click(screen.getByRole("button", { name: "Complete in page" }));

		await screen.findByText("Final PDF is available");
		const completedDocumentLink = await screen.findByRole("link", {
			name: "View completed document",
		});
		expect(completedDocumentLink.getAttribute("href")).toBe(
			"/completed-documents/90000000-0000-4000-8000-000000000001",
		);
		const finalPdfLink = await screen.findByRole("link", { name: "Download final PDF" });
		expect(finalPdfLink.getAttribute("href")).toBe(
			"/api/final-documents/90000000-0000-4000-8000-000000000001/pdf",
		);
		expect(fetchMock.mock.calls[1]?.[0]).toBe(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf",
		);
		const uploadOptions = fetchMock.mock.calls[1]?.[1] as { body?: unknown; method?: string };
		expect(uploadOptions.method).toBe("POST");
		expect(ArrayBuffer.isView(uploadOptions.body)).toBe(true);
		expect(fetchMock.mock.calls[2]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({ "x-internal-user-id": "manual-ui" }),
			}),
		);
		expect(fetchMock.mock.calls[3]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({ "x-internal-user-id": "manual-ui" }),
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith("/api/signing/verifications/valid-token");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/signing/valid-token/complete",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ "x-email-delivery-test-bypass": "true" }),
				body: JSON.stringify({ signatureName: "Ada Lovelace", date: "2026-05-20" }),
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith("/api/signing/valid-token");
	});
});
