// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildSourcePdfPreviewUrl, EnvelopeFieldEditor } from "./field-editor";
import { buildNextSignatureField, signatureDimensions } from "./field-placement-workspace";

describe("EnvelopeFieldEditor", () => {
	it("builds a sender-authorized uploaded PDF preview URL", () => {
		expect(
			buildSourcePdfPreviewUrl("00000000-0000-4000-8000-000000000001", "verified-sender-token"),
		).toBe(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf/content?senderSessionToken=verified-sender-token#toolbar=0&navpanes=0&scrollbar=0&page=1",
		);
	});

	it("moves the next signer default placeholder when the previous coordinates are occupied", () => {
		const recipients = [
			{
				id: "20000000-0000-4000-8000-000000000001",
				name: "Ada Lovelace",
				email: "ada@example.com",
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				name: "Grace Hopper",
				email: "grace@example.com",
			},
		];

		const nextField = buildNextSignatureField(
			{
				recipientId: recipients[0]?.id ?? "",
				type: "signature",
				page: 1,
				x: 72,
				y: 144,
				width: signatureDimensions.width,
				height: signatureDimensions.height,
			},
			recipients,
			new Set([recipients[0]?.id ?? ""]),
			[
				{
					id: "50000000-0000-4000-8000-000000000001",
					envelopeId: "00000000-0000-4000-8000-000000000001",
					recipientId: recipients[0]?.id ?? "",
					type: "signature",
					page: 1,
					x: 72,
					y: 144,
					width: signatureDimensions.width,
					height: signatureDimensions.height,
					createdAt: "2026-05-20T07:05:00.000Z",
				},
			],
		);

		expect(nextField).toEqual({
			recipientId: recipients[1]?.id,
			type: "signature",
			page: 1,
			x: 72,
			y: 216,
			width: signatureDimensions.width,
			height: signatureDimensions.height,
		});
	});

	it("persists field placement by dragging the field on the visual PDF preview", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/fields" &&
				init?.method === "POST"
			) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "50000000-0000-4000-8000-000000000001",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								recipientId: "20000000-0000-4000-8000-000000000001",
								type: "signature",
								page: 1,
								x: 96,
								y: 192,
								width: 180,
								height: 48,
								createdAt: "2026-05-20T07:05:00.000Z",
							},
						],
					}),
					{ status: 201 },
				);
			}
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<EnvelopeFieldEditor
				envelopeId="00000000-0000-4000-8000-000000000001"
				recipients={[
					{
						id: "20000000-0000-4000-8000-000000000001",
						name: "Ada Lovelace",
						email: "ada@example.com",
					},
					{
						id: "20000000-0000-4000-8000-000000000002",
						name: "Grace Hopper",
						email: "grace@example.com",
					},
				]}
			/>,
		);

		const preview = screen.getByLabelText("PDF page preview");
		vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			left: 0,
			top: 0,
			right: 306,
			bottom: 396,
			width: 306,
			height: 396,
			toJSON: () => ({}),
		});
		expect(preview).toBeTruthy();
		expect(screen.getByTitle("Uploaded source PDF preview").getAttribute("src")).toBe(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/source-pdf/content#toolbar=0&navpanes=0&scrollbar=0&page=1",
		);
		expect(screen.queryByLabelText("X")).toBeNull();
		expect(screen.queryByLabelText("Y")).toBeNull();
		expect(screen.queryByLabelText("Width")).toBeNull();
		expect(screen.queryByLabelText("Height")).toBeNull();
		expect(await screen.findByLabelText("Current signature placeholder")).toBeDefined();
		expect(screen.getByLabelText("Current signature placeholder").textContent).toContain(
			"Ada Lovelace",
		);
		fireEvent.mouseDown(screen.getByLabelText("Current signature placeholder"), {
			clientX: 36,
			clientY: 72,
		});
		fireEvent.mouseMove(preview, {
			clientX: 48,
			clientY: 96,
		});
		fireEvent.mouseUp(preview);
		fireEvent.click(screen.getByRole("button", { name: "Place Ada Lovelace signature" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		await waitFor(() =>
			expect(screen.getByLabelText("Ada Lovelace signature status").textContent).toContain(
				"Placed",
			),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/fields",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-user-id": "ui-user",
				},
				body: JSON.stringify({
					fields: [
						{
							recipientId: "20000000-0000-4000-8000-000000000001",
							type: "signature",
							page: 1,
							x: 96,
							y: 192,
							width: 180,
							height: 48,
						},
					],
				}),
			}),
		);
	});

	it("shows signer placement status and disables saving after every signer has a signature placeholder", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (
				url === "/api/envelopes/00000000-0000-4000-8000-000000000001/fields" &&
				init?.method === "POST"
			) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "50000000-0000-4000-8000-000000000002",
								envelopeId: "00000000-0000-4000-8000-000000000001",
								recipientId: "20000000-0000-4000-8000-000000000002",
								type: "signature",
								page: 1,
								x: 72,
								y: 144,
								width: 180,
								height: 48,
								createdAt: "2026-05-20T07:06:00.000Z",
							},
						],
					}),
					{ status: 201 },
				);
			}
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "50000000-0000-4000-8000-000000000001",
							envelopeId: "00000000-0000-4000-8000-000000000001",
							recipientId: "20000000-0000-4000-8000-000000000001",
							type: "signature",
							page: 1,
							x: 72,
							y: 144,
							width: 180,
							height: 48,
							createdAt: "2026-05-20T07:05:00.000Z",
						},
					],
				}),
				{ status: 200 },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<EnvelopeFieldEditor
				envelopeId="00000000-0000-4000-8000-000000000001"
				recipients={[
					{
						id: "20000000-0000-4000-8000-000000000001",
						name: "Ada Lovelace",
						email: "ada@example.com",
					},
					{
						id: "20000000-0000-4000-8000-000000000002",
						name: "Grace Hopper",
						email: "grace@example.com",
					},
				]}
			/>,
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Ada Lovelace signature status").textContent).toContain(
				"Placed",
			),
		);
		expect(screen.getByLabelText("Ada Lovelace signature status").textContent).toContain("Placed");
		expect(screen.getByLabelText("Grace Hopper signature status").textContent).toContain(
			"Needs placement",
		);
		expect(screen.getByLabelText("Current signature placeholder").textContent).toContain(
			"Grace Hopper",
		);

		fireEvent.click(screen.getByRole("button", { name: "Place Grace Hopper signature" }));
		await screen.findByText("All signers have signature placeholders.");

		const disabledButton = screen.getByRole("button", { name: "All signatures placed" });
		expect(disabledButton.hasAttribute("disabled")).toBe(true);
	});
});

function renderWithQueryClient(ui: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
