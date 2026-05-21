// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignatureProfilePanel } from "./signature-profile-panel";

describe("SignatureProfilePanel", () => {
	it("captures a drawn signature and persists it as the selected profile", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							id: "60000000-0000-4000-8000-000000000001",
							kind: "drawn",
							label: "Ada drawn",
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignatureProfilePanel envelopeId="00000000-0000-4000-8000-000000000001" />);

		fireEvent.mouseDown(screen.getByLabelText("Draw signature"), {
			clientX: 12,
			clientY: 36,
		});
		fireEvent.mouseMove(screen.getByLabelText("Draw signature"), {
			clientX: 48,
			clientY: 20,
		});
		fireEvent.mouseMove(screen.getByLabelText("Draw signature"), {
			clientX: 96,
			clientY: 42,
		});
		fireEvent.mouseUp(screen.getByLabelText("Draw signature"));
		fireEvent.change(screen.getByLabelText("Drawn profile label"), {
			target: { value: "Ada drawn" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save drawn signature" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await screen.findByText("Ada drawn selected");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-user-id": "ui-user",
				},
				body: JSON.stringify({
					kind: "drawn",
					label: "Ada drawn",
					svgPath: "M 12 36 L 48 20 L 96 42",
					selected: true,
				}),
			}),
		);
	});

	it("generates a typed signature-like mark and persists it as the selected profile", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							id: "60000000-0000-4000-8000-000000000002",
							kind: "typed",
							label: "Ada typed",
						},
					}),
					{ status: 201 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		render(<SignatureProfilePanel envelopeId="00000000-0000-4000-8000-000000000001" />);

		fireEvent.change(screen.getByLabelText("Typed name"), { target: { value: "Ada Lovelace" } });
		fireEvent.change(screen.getByLabelText("Typed font"), { target: { value: "cursive" } });
		fireEvent.change(screen.getByLabelText("Typed profile label"), {
			target: { value: "Ada typed" },
		});
		expect(screen.getByLabelText("Typed signature preview").textContent).toBe("Ada Lovelace");
		fireEvent.click(screen.getByRole("button", { name: "Save typed signature" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await screen.findByText("Ada typed selected");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-user-id": "ui-user",
				},
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
