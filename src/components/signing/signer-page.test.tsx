// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignerPage } from "./signer-page";

describe("SignerPage", () => {
	it("loads assigned fields and submits typed signing values", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
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
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		render(<SignerPage token="valid-token" />);

		await screen.findByText("signature");
		fireEvent.change(screen.getByLabelText("Typed signature"), {
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
					signatureName: "Ada Lovelace",
					date: "2026-05-20",
				}),
			}),
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
});
