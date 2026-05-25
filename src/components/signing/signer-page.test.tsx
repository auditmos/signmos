// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignerPage } from "./signer-page";

describe("SignerPage", () => {
	it("shows a loading state while resolving the signing link", () => {
		vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

		render(<SignerPage token="valid-token" />);

		expect(screen.getByText("Loading signing session")).toBeTruthy();
	});

	it("loads assigned fields and submits typed signing values", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							sourceDocument: {
								version: 1,
								contentType: "application/pdf",
								downloadUrl: "/api/signing/valid-token/source-pdf",
							},
							fields: [
								{
									id: "field-1",
									type: "signature",
									page: 1,
									x: 72,
									y: 144,
									width: 180,
									height: 48,
								},
								{ id: "field-2", type: "date", page: 1, x: 300, y: 144, width: 120, height: 32 },
							],
							signaturePreference: null,
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("signature");
		expect(screen.getByRole("link", { name: "Open source PDF" }).getAttribute("href")).toBe(
			"/api/signing/valid-token/source-pdf",
		);
		expect(screen.getByTitle("Source PDF preview").getAttribute("src")).toBe(
			"/api/signing/valid-token/source-pdf#toolbar=0&navpanes=0&scrollbar=0&page=1",
		);
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada Lovelace" },
		});
		await waitFor(() =>
			expect(screen.getByLabelText("Typed signature text")).toHaveProperty("value", "Ada Lovelace"),
		);
		expect(screen.queryByLabelText("Signing date")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Complete signing" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/signing/valid-token/complete",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					signature: {
						kind: "typed",
						typedText: "Ada Lovelace",
						typedFont: "cursive",
					},
					rememberSignature: false,
				}),
			}),
		);
	});

	it("overlays completed sender values and partner placeholders on the PDF preview", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					data: {
						envelopeId: "00000000-0000-4000-8000-000000000001",
						recipientId: "20000000-0000-4000-8000-000000000002",
						sourceDocument: {
							version: 1,
							contentType: "application/pdf",
							downloadUrl: "/api/signing/valid-token/source-pdf",
						},
						fields: [
							{
								id: "field-partner",
								type: "signature",
								page: 1,
								x: 72,
								y: 224,
								width: 180,
								height: 48,
							},
						],
						previewFields: [
							{
								id: "field-sender",
								recipientId: "20000000-0000-4000-8000-000000000001",
								recipientName: "Tomasz Kowalczyk",
								type: "signature",
								page: 1,
								x: 72,
								y: 144,
								width: 180,
								height: 48,
								value: "Tomasz Kowalczyk",
								assignedToCurrentSigner: false,
							},
							{
								id: "field-partner",
								recipientId: "20000000-0000-4000-8000-000000000002",
								recipientName: "Tom",
								type: "signature",
								page: 1,
								x: 72,
								y: 224,
								width: 180,
								height: 48,
								value: null,
								assignedToCurrentSigner: true,
							},
						],
						signaturePreference: null,
					},
				}),
				{ status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		expect(
			(await screen.findByLabelText("Tomasz Kowalczyk signature value")).textContent,
		).toContain("Tomasz Kowalczyk");
		expect(screen.getByLabelText("Tom signature placeholder").textContent).toContain(
			"signature here",
		);
	});

	it("allows switching between typed and drawn signatures while keeping saved-profile updates selected", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							sourceDocument: {
								version: 1,
								contentType: "application/pdf",
								downloadUrl: "/api/signing/valid-token/source-pdf",
							},
							fields: [
								{
									id: "field-1",
									type: "signature",
									page: 1,
									x: 72,
									y: 144,
									width: 180,
									height: 48,
								},
							],
							signaturePreference: {
								id: "60000000-0000-4000-8000-000000000001",
								envelopeId: "00000000-0000-4000-8000-000000000099",
								createdBy: "ada@example.com",
								kind: "typed",
								label: "Ada saved typed",
								svgPath: null,
								typedText: "Ada Saved",
								typedFont: "serif",
								selected: true,
								createdAt: "2026-05-20T09:00:00.000Z",
							},
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("signature");
		expect(screen.getByLabelText("Typed signature text")).toHaveProperty("value", "Ada Saved");
		expect(screen.getByLabelText("Signature font")).toHaveProperty("value", "serif");
		const rememberCheckbox = screen.getByLabelText("Remember signature for future envelopes");
		expect(rememberCheckbox).toHaveProperty("checked", true);

		fireEvent.click(screen.getByRole("button", { name: "Choose drawn signature" }));
		expect(screen.getByLabelText("Draw signature pad")).toBeTruthy();
		expect(screen.queryByLabelText("Typed signature text")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Choose typed signature" }));
		expect(screen.queryByLabelText("Signing date")).toBeNull();
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada New" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Complete signing" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/signing/valid-token/complete",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					signature: {
						kind: "typed",
						typedText: "Ada New",
						typedFont: "serif",
					},
					rememberSignature: true,
				}),
			}),
		);
	});

	it("shows backend signing completion errors", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							sourceDocument: {
								version: 1,
								contentType: "application/pdf",
								downloadUrl: "/api/signing/valid-token/source-pdf",
							},
							fields: [
								{
									id: "field-1",
									type: "signature",
									page: 1,
									x: 72,
									y: 144,
									width: 180,
									height: 48,
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
						error: {
							code: "NO_ASSIGNED_FIELDS",
							message: "No signing fields are assigned to this recipient",
						},
					}),
					{ status: 409 },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("signature");
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada Lovelace" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Complete signing" }));

		await screen.findByText("No signing fields are assigned to this recipient");
	});

	it("submits a change request comment from the signer page", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							sourceDocument: {
								version: 1,
								contentType: "application/pdf",
								downloadUrl: "/api/signing/valid-token/source-pdf",
							},
							fields: [],
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByRole("link", { name: "Open source PDF" });
		expect(screen.getByText("No assigned fields")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Complete signing" })).toHaveProperty(
			"disabled",
			true,
		);
		fireEvent.change(screen.getByLabelText("Change request comment"), {
			target: { value: "Please update the billing address." },
		});
		fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/signing/valid-token/change-request",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ comment: "Please update the billing address." }),
			}),
		);
		await screen.findByText("Changes requested");
		expect(screen.getByRole("button", { name: "Complete signing" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Request changes" })).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("shows the partner verification link when signing access is blocked", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: "PARTNER_VERIFICATION_REQUIRED",
						message: "Partner email verification is required before signing",
						verificationUrl: "/api/signing/verifications/valid-token",
					},
				}),
				{ status: 403 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("Partner email verification is required before signing");
		expect(screen.getByRole("link", { name: "Verify email" }).getAttribute("href")).toBe(
			"/api/signing/verifications/valid-token",
		);
	});

	it("shows completed document links when a signing link is already complete", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
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

		render(<SignerPage token="valid-token" />);

		await screen.findByText("Document complete");
		expect(screen.getByRole("link", { name: "View completed document" }).getAttribute("href")).toBe(
			"/completed-documents/90000000-0000-4000-8000-000000000001",
		);
		expect(screen.getByRole("link", { name: "Download final PDF" }).getAttribute("href")).toBe(
			"/api/final-documents/90000000-0000-4000-8000-000000000001/pdf",
		);
		expect(screen.queryByRole("button", { name: "Complete signing" })).toBeNull();
	});

	it("shows an expired signing-link message without signing controls", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: "ENVELOPE_EXPIRED",
						message: "This signing link is no longer active",
					},
				}),
				{ status: 410 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("This signing link is no longer active");
		expect(screen.queryByRole("button", { name: "Complete signing" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull();
	});

	it("shows a deleted document message without PDF or signing controls", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: "ENVELOPE_DELETED",
						message: "This document was deleted by the sender",
					},
				}),
				{ status: 410 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("This document was deleted by the sender");
		expect(screen.queryByRole("link", { name: "Open source PDF" })).toBeNull();
		expect(screen.queryByTitle("Source PDF preview")).toBeNull();
		expect(screen.queryByRole("button", { name: "Complete signing" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull();
	});
});
