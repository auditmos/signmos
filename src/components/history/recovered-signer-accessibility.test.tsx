// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { SignerPage } from "@/components/signing/signer-page";

const envelopeId = "00000000-0000-4000-8000-000000000040";

describe("recovered signer accessibility", () => {
	it("renders tokenless review, signature, and alternate-action controls with native labels", async () => {
		// Issue #40 assumptions before RED:
		// - The shared signer component receives an envelope locator, never a bearer credential.
		// - Existing labelled controls stay keyboard-operable in recovered mode.
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId,
							recipientId: "20000000-0000-4000-8000-000000000040",
							signingMode: "me_and_another_signer",
							sourceDocument: {
								version: 2,
								contentType: "application/pdf",
								downloadUrl: `/api/history/documents/${envelopeId}/signing/source-pdf`,
							},
							fields: [
								{
									id: "50000000-0000-4000-8000-000000000040",
									type: "signature",
									page: 1,
									x: 72,
									y: 144,
									width: 180,
									height: 48,
								},
							],
							previewFields: [],
							signaturePreference: null,
						},
					}),
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage historyEnvelopeId={envelopeId} />);

		expect(await screen.findByRole("heading", { name: "Review and sign" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Open source PDF" }).getAttribute("href")).toBe(
			`/api/history/documents/${envelopeId}/signing/source-pdf`,
		);
		expect(screen.getByLabelText("Typed signature text")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Complete signing" })).toBeTruthy();
		expect(screen.getByLabelText("Change request comment")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Request changes" })).toBeTruthy();
		expect(screen.getByLabelText("Decline reason")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(`/api/history/documents/${envelopeId}/signing`);
		expect(document.body.textContent).not.toContain("invitation-token");
	});

	it.each([
		["expired", "This document expired"],
		["declined", "This document was declined"],
		["deleted", "This document was deleted"],
	])("renders the %s terminal state without signing mutations", async (_state, message) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ error: { message } }), { status: 410 })),
		);
		render(<SignerPage historyEnvelopeId={envelopeId} />);

		expect(await screen.findByText(message)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Complete signing" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
	});

	it("renders session-protected completion actions", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								completedDocument: {
									url: `/my-documents/${envelopeId}`,
									downloadUrl: `/api/history/documents/${envelopeId}/pdf`,
								},
							},
						}),
					),
			),
		);
		render(<SignerPage historyEnvelopeId={envelopeId} />);

		expect(await screen.findByText("Document complete")).toBeTruthy();
		expect(screen.getByRole("link", { name: "View completed document" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Download final PDF" })).toBeTruthy();
	});
});
