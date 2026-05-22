// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { CompletedDocumentPage } from "./completed-document-page";

describe("CompletedDocumentPage", () => {
	it("renders final PDF access, parties, signed dates, status, and public history", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							token: "90000000-0000-4000-8000-000000000001",
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "completed",
							finalPdf: {
								downloadUrl: "/api/final-documents/90000000-0000-4000-8000-000000000001/pdf",
								contentType: "application/pdf",
								byteSize: 32,
								sha256: "b".repeat(64),
								createdAt: "2026-05-21T09:11:00.000Z",
							},
							parties: [
								{
									id: "20000000-0000-4000-8000-000000000001",
									name: "Sender Example",
									email: "sender@example.com",
									status: "completed",
									signedDate: "2026-05-20",
									signedAt: "2026-05-20T07:06:00.000Z",
								},
								{
									id: "20000000-0000-4000-8000-000000000002",
									name: "Ada Lovelace",
									email: "ada@example.com",
									status: "completed",
									signedDate: "2026-05-21",
									signedAt: "2026-05-21T09:10:00.000Z",
								},
							],
							history: [
								{
									type: "sent",
									title: "Envelope sent",
									detail: "sender@example.com",
									occurredAt: "2026-05-20T07:04:00.000Z",
								},
								{
									type: "viewed",
									title: "Ada Lovelace viewed the document",
									detail: null,
									occurredAt: "2026-05-21T09:00:00.000Z",
								},
								{
									type: "signed",
									title: "Ada Lovelace signed",
									detail: "Ada Lovelace",
									occurredAt: "2026-05-21T09:10:00.000Z",
								},
							],
						},
					}),
					{ status: 200 },
				),
			),
		);

		render(<CompletedDocumentPage token="90000000-0000-4000-8000-000000000001" />);

		await screen.findByText("Completed document");
		expect(screen.getByText("Final status")).toBeTruthy();
		expect(screen.getByText("completed")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Download final PDF" }).getAttribute("href")).toBe(
			"/api/final-documents/90000000-0000-4000-8000-000000000001/pdf",
		);
		expect(screen.getByText("Sender Example")).toBeTruthy();
		expect(screen.getAllByText("sender@example.com")).toHaveLength(2);
		expect(screen.getByText("Signed date 2026-05-20")).toBeTruthy();
		expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
		expect(screen.getByText("ada@example.com")).toBeTruthy();
		expect(screen.getByText("Signed date 2026-05-21")).toBeTruthy();
		expect(screen.getByText("Envelope sent")).toBeTruthy();
		expect(screen.getByText("Ada Lovelace viewed the document")).toBeTruthy();
		expect(screen.getByText("Ada Lovelace signed")).toBeTruthy();
		expect(screen.queryByText("partner.verified")).toBeNull();
	});
});
