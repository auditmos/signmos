// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { SourcePdfUploadPanel } from "./source-pdf-upload-panel";

const envelopeId = "00000000-0000-4000-8000-000000000001";
const recipientsUrl = `/api/envelopes/${envelopeId}/recipients`;
const partnerRecipientId = "20000000-0000-4000-8000-000000000002";
const partnerRecipientUrl = `${recipientsUrl}/${partnerRecipientId}`;

interface RecipientFixture {
	id: string;
	envelopeId: string;
	name: string;
	email: string;
}

describe("SourcePdfUploadPanel recipient management", () => {
	beforeEach(() => {
		vi.stubGlobal("crypto", { randomUUID: () => "upload-idempotency-key" });
	});

	it("disables duplicate recipient adds and lets the sender edit or delete the partner", async () => {
		const fetchMock = createRecipientsFetchMock([
			{
				id: "20000000-0000-4000-8000-000000000001",
				envelopeId,
				name: "Ada Lovelace",
				email: "ada@example.com",
			},
			{
				id: partnerRecipientId,
				envelopeId,
				name: "Tom Typo",
				email: "typo@example.com",
			},
		]);
		vi.stubGlobal("fetch", fetchMock);

		renderWithQueryClient(
			<SourcePdfUploadPanel
				envelopeId={envelopeId}
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
			partnerRecipientUrl,
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
			partnerRecipientUrl,
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});

function createRecipientsFetchMock(initialRecipients: RecipientFixture[]) {
	const state = { recipients: initialRecipients };
	return vi.fn((url: string | URL | Request, init?: RequestInit) =>
		handleRecipientsFetch(state, url, init),
	);
}

async function handleRecipientsFetch(
	state: { recipients: RecipientFixture[] },
	url: string | URL | Request,
	init?: RequestInit,
) {
	const method = init?.method ?? "GET";
	if (url === `/api/envelopes/${envelopeId}/source-pdf`) return sourcePdfResponse();
	if (url === recipientsUrl && method === "GET") {
		return new Response(JSON.stringify({ data: state.recipients }), { status: 200 });
	}
	if (url === partnerRecipientUrl) return handlePartnerFetch(state, method, init);
	throw new Error(`Unexpected fetch ${String(url)} ${method}`);
}

async function handlePartnerFetch(
	state: { recipients: RecipientFixture[] },
	method: string,
	init?: RequestInit,
) {
	if (method === "PATCH") {
		const body = JSON.parse(String(init?.body)) as { name: string; email: string };
		state.recipients = state.recipients.map((recipient) =>
			recipient.id === partnerRecipientId ? { ...recipient, ...body } : recipient,
		);
		return new Response(JSON.stringify({ data: state.recipients[1] }), { status: 200 });
	}
	if (method === "DELETE") {
		const [sender, partner] = state.recipients;
		state.recipients = sender ? [sender] : [];
		return new Response(JSON.stringify({ data: partner }), { status: 200 });
	}
	throw new Error(`Unexpected partner request ${method}`);
}

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
