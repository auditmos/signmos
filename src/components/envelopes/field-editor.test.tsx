// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnvelopeFieldEditor } from "./field-editor";

describe("EnvelopeFieldEditor", () => {
	it("persists sender and partner field placement using the visual PDF preview", async () => {
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ data: [] }), { status: 201 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(
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

		expect(screen.getByLabelText("PDF page preview")).toBeTruthy();
		expect(screen.getByLabelText("Current field preview").textContent).toContain("Ada Lovelace");
		fireEvent.click(screen.getByRole("button", { name: "Save field" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		fireEvent.change(screen.getByLabelText("Recipient"), {
			target: { value: "20000000-0000-4000-8000-000000000002" },
		});
		fireEvent.change(screen.getByLabelText("Type"), { target: { value: "date" } });
		fireEvent.change(screen.getByLabelText("Page"), { target: { value: "2" } });
		fireEvent.change(screen.getByLabelText("X"), { target: { value: "96" } });
		fireEvent.change(screen.getByLabelText("Y"), { target: { value: "192" } });
		fireEvent.change(screen.getByLabelText("Width"), { target: { value: "140" } });
		fireEvent.change(screen.getByLabelText("Height"), { target: { value: "36" } });
		expect(screen.getByLabelText("Current field preview").textContent).toContain("Grace Hopper");
		fireEvent.click(screen.getByRole("button", { name: "Save field" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await screen.findByText("Field saved");
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
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
							x: 72,
							y: 144,
							width: 180,
							height: 48,
						},
					],
				}),
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
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
							recipientId: "20000000-0000-4000-8000-000000000002",
							type: "date",
							page: 2,
							x: 96,
							y: 192,
							width: 140,
							height: 36,
						},
					],
				}),
			}),
		);
	});
});
