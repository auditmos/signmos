// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { SenderVerificationPage } from "./sender-verification-page";

describe("SenderVerificationPage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("verifies the sender token and redirects to source PDF upload", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							envelopeId: "00000000-0000-4000-8000-000000000001",
							status: "draft",
							signingMode: "only_me",
							senderSessionToken: "sender-token",
							sender: {
								name: "Ada Lovelace",
								email: "ada@example.com",
							},
							allowedActions: ["upload_source_pdf"],
							verifiedAt: "2026-05-21T09:05:00.000Z",
						},
					}),
					{ status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const onVerified = vi.fn();

		render(<SenderVerificationPage token="sender-token" onVerified={onVerified} />);

		await screen.findByText("Email verified");
		const expectedUrl =
			"/source-pdf-upload?envelopeId=00000000-0000-4000-8000-000000000001&senderSessionToken=sender-token&senderName=Ada+Lovelace&senderEmail=ada%40example.com&signingMode=only_me";
		expect(screen.getByRole("link", { name: "Continue to upload PDF" }).getAttribute("href")).toBe(
			expectedUrl,
		);
		await waitFor(() => expect(onVerified).toHaveBeenCalledWith(expectedUrl));
		expect(fetchMock).toHaveBeenCalledWith("/api/envelopes/sender-verifications/sender-token");
	});

	it("shows verification errors without redirecting", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "EXPIRED_SENDER_VERIFICATION",
								message: "Sender verification token has expired",
							},
						}),
						{ status: 410 },
					),
			),
		);
		const onVerified = vi.fn();

		render(<SenderVerificationPage token="expired-token" onVerified={onVerified} />);

		await screen.findByText("Verification failed");
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain("Sender verification token has expired");
		expect(onVerified).not.toHaveBeenCalled();
	});
});
