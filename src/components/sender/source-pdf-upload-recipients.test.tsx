// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { SourcePdfUploadPanel } from "./source-pdf-upload-panel";

describe("SourcePdfUploadPanel recipient management", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "upload-idempotency-key" });
	});

	it("disables duplicate recipient adds and lets the sender edit or delete the partner", async () => {
		let recipients = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Ada Lovelace",
				email: "ada@example.com",
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000001",
				name: "Tom Typo",
				email: "typo@example.com",
			},
		];
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf") {
				return sourcePdfResponse();
			}
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients" &&
				init?.method !== "POST"
			) {
				return new Response(JSON.stringify({ data: recipients }), { status: 200 });
			}
			if (
				url ===
					"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients/20000000-0000-4000-8000-000000000002" &&
				init?.method === "PATCH"
			) {
				const body = JSON.parse(String(init.body)) as { name: string; email: string };
				recipients = recipients.map((recipient) =>
					recipient.id === "20000000-0000-4000-8000-000000000002"
						? { ...recipient, ...body }
						: recipient,
				);
				return new Response(JSON.stringify({ data: recipients[1] }), { status: 200 });
			}
			if (
				url ===
					"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients/20000000-0000-4000-8000-000000000002" &&
				init?.method === "DELETE"
			) {
				const [sender, partner] = recipients;
				recipients = sender ? [sender] : [];
				return new Response(JSON.stringify({ data: partner }), { status: 200 });
			}
			throw new Error(`Unexpected fetch ${String(url)} ${init?.method ?? "GET"}`);
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

		await screen.findByText("Tom Typo");
		expect(screen.getByRole("button", { name: "Add recipients" }).hasAttribute("disabled")).toBe(
			true,
		);

		fireEvent.click(screen.getByRole("button", { name: "Edit recipient" }));
		fireEvent.change(screen.getByLabelText("Partner name"), { target: { value: "Tom Corrected" } });
		fireEvent.change(screen.getByLabelText("Partner email"), {
			target: { value: "tom@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save recipient" }));

		await screen.findByText("Tom Corrected");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients/20000000-0000-4000-8000-000000000002",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ name: "Tom Corrected", email: "tom@example.com" }),
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "Delete recipient" }));

		await screen.findByLabelText("Partner name");
		expect(screen.getByRole("button", { name: "Add recipients" }).hasAttribute("disabled")).toBe(
			false,
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients/20000000-0000-4000-8000-000000000002",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});

function sourcePdfResponse() {
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
		{ status: 200 },
	);
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
