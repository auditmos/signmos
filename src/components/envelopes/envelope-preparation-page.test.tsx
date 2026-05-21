// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnvelopePreparationPage } from "./envelope-preparation-page";

describe("EnvelopePreparationPage", () => {
	it("creates a real review envelope before enabling signature saves from the default route", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/envelopes") {
				return new Response(
					JSON.stringify({
						data: {
							id: "00000000-0000-4000-8000-000000000001",
							status: "draft",
							createdBy: "ui-user",
							createdAt: "2026-05-21T09:00:00.000Z",
						},
					}),
					{ status: 201 },
				);
			}
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/recipients") {
				return new Response(
					JSON.stringify({
						data: [
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
						],
					}),
					{ status: 201 },
				);
			}
			if (url === "/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles") {
				return new Response(
					JSON.stringify({
						data: {
							id: "60000000-0000-4000-8000-000000000001",
							label: "Ada typed",
						},
					}),
					{ status: 201 },
				);
			}
			return new Response(JSON.stringify({ error: { code: "UNEXPECTED" } }), { status: 500 });
		});
		vi.stubGlobal("fetch", fetchMock);

		render(<EnvelopePreparationPage />);

		expect(screen.queryByText("Signature profile")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Create review envelope" }));

		await screen.findByText("Signature profile");
		fireEvent.change(screen.getByLabelText("Typed name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Typed profile label"), {
			target: { value: "Ada typed" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save typed signature" }));

		await screen.findByText("Ada typed selected");
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"/api/envelopes",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/envelopes/00000000-0000-4000-8000-000000000001/recipients",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					kind: "typed",
					label: "Ada typed",
					typedText: "Ada Lovelace",
					typedFont: "cursive",
					selected: true,
				}),
			}),
		);
	});
});
