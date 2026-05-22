// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SignatureProfilePanel } from "./signature-profile-panel";

describe("SignatureProfilePanel", () => {
	it("captures a drawn signature and persists it as the selected profile", async () => {
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === "POST") {
				return signatureProfileResponse("drawn", "Ada drawn");
			}
			return new Response(JSON.stringify({ data: null }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SignatureProfilePanel envelopeId="00000000-0000-4000-8000-000000000001" />,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Choose drawn signature" }));
		const drawingPad = screen.getByLabelText("Draw signature pad");
		vi.spyOn(drawingPad, "getBoundingClientRect").mockReturnValue({
			x: 100,
			y: 50,
			left: 100,
			top: 50,
			right: 740,
			bottom: 306,
			width: 640,
			height: 256,
			toJSON: () => ({}),
		});

		fireEvent.mouseDown(drawingPad, {
			clientX: 420,
			clientY: 178,
		});
		fireEvent.mouseMove(drawingPad, {
			clientX: 484,
			clientY: 146,
		});
		fireEvent.mouseMove(drawingPad, {
			clientX: 580,
			clientY: 190,
		});
		fireEvent.mouseUp(drawingPad);
		fireEvent.change(screen.getByLabelText("Preference name"), {
			target: { value: "Ada drawn" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save signature preference" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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
					svgPath: "M 160 64 L 192 48 L 240 70",
					selected: true,
				}),
			}),
		);
	});

	it("generates a typed signature-like mark and persists it as the selected profile", async () => {
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === "POST") {
				return signatureProfileResponse("typed", "Ada typed");
			}
			return new Response(JSON.stringify({ data: null }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SignatureProfilePanel envelopeId="00000000-0000-4000-8000-000000000001" />,
		);

		await screen.findByRole("button", { name: "Choose typed signature" });
		fireEvent.change(screen.getByLabelText("Typed signature text"), {
			target: { value: "Ada Lovelace" },
		});
		fireEvent.change(screen.getByLabelText("Signature font"), { target: { value: "cursive" } });
		fireEvent.change(screen.getByLabelText("Preference name"), {
			target: { value: "Ada typed" },
		});
		expect(screen.getByLabelText("Typed signature preview").textContent).toBe("Ada Lovelace");
		fireEvent.click(screen.getByRole("button", { name: "Save signature preference" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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

	it("loads the sender's previous typed signature preference and shows only that method", async () => {
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === "POST") {
				return signatureProfileResponse("typed", "Ada typed");
			}
			return new Response(
				JSON.stringify({
					data: {
						id: "60000000-0000-4000-8000-000000000002",
						envelopeId: "00000000-0000-4000-8000-000000000099",
						createdBy: "ada@example.com",
						kind: "typed",
						label: "Ada typed",
						svgPath: null,
						typedText: "Ada Lovelace",
						typedFont: "serif",
						selected: true,
						createdAt: "2026-05-21T09:00:00.000Z",
					},
				}),
				{ status: 200 },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SignatureProfilePanel
				envelopeId="00000000-0000-4000-8000-000000000001"
				senderSessionToken="verified-sender-token"
			/>,
		);

		expect(await screen.findByDisplayValue("Ada Lovelace")).toBeDefined();
		expect(screen.getByLabelText("Signature font")).toHaveProperty("value", "serif");
		expect(
			screen.getByRole("button", { name: "Choose typed signature" }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(screen.queryByLabelText("Draw signature pad")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Save signature preference" }));

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-sender-session-token": "verified-sender-token",
					},
					body: JSON.stringify({
						kind: "typed",
						label: "Ada typed",
						typedText: "Ada Lovelace",
						typedFont: "serif",
						selected: true,
					}),
				}),
			),
		);
	});
});

function signatureProfileResponse(kind: "drawn" | "typed", label: string) {
	return new Response(
		JSON.stringify({
			data: {
				id:
					kind === "drawn"
						? "60000000-0000-4000-8000-000000000001"
						: "60000000-0000-4000-8000-000000000002",
				kind,
				label,
			},
		}),
		{ status: 201 },
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
