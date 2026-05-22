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
			"/api/signing/valid-token/source-pdf",
		);
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada Lovelace" },
		});
		fireEvent.change(screen.getByLabelText("Signing date"), { target: { value: "2026-05-20" } });
		fireEvent.click(screen.getByRole("button", { name: "Complete signing" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/signing/valid-token/complete",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					date: "2026-05-20",
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

	it("allows switching between typed and drawn signatures with explicit unchecked remember consent", async () => {
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
		expect(rememberCheckbox).toHaveProperty("checked", false);

		fireEvent.click(screen.getByRole("button", { name: "Choose drawn signature" }));
		expect(screen.getByLabelText("Draw signature pad")).toBeTruthy();
		expect(screen.queryByLabelText("Typed signature text")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Choose typed signature" }));
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada New" },
		});
		fireEvent.change(screen.getByLabelText("Signing date"), { target: { value: "2026-05-20" } });
		fireEvent.click(screen.getByRole("button", { name: "Complete signing" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenLastCalledWith(
			"/api/signing/valid-token/complete",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					date: "2026-05-20",
					signature: {
						kind: "typed",
						typedText: "Ada New",
						typedFont: "serif",
					},
					rememberSignature: false,
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
		fireEvent.change(screen.getByLabelText("Signing date"), { target: { value: "2026-05-20" } });
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
