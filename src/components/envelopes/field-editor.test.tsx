// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnvelopeFieldEditor } from "./field-editor";

describe("EnvelopeFieldEditor", () => {
	it("persists visual field placement using the shared coordinate model", async () => {
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
				]}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Type"), { target: { value: "date" } });
		fireEvent.change(screen.getByLabelText("Page"), { target: { value: "2" } });
		fireEvent.change(screen.getByLabelText("X"), { target: { value: "96" } });
		fireEvent.change(screen.getByLabelText("Y"), { target: { value: "192" } });
		fireEvent.change(screen.getByLabelText("Width"), { target: { value: "140" } });
		fireEvent.change(screen.getByLabelText("Height"), { target: { value: "36" } });
		fireEvent.click(screen.getByRole("button", { name: "Save field" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await screen.findByText("Field saved");
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
