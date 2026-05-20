import { Check, FileText, Play, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SigningLink {
	recipientId: string;
	email: string;
	token: string;
	url: string;
}

interface SmokeState {
	envelopeId: string;
	recipientId: string;
	signingLink: SigningLink;
	finalPdfAvailable: boolean;
}

export function ManualSigningSmokePage() {
	const [state, setState] = useState<SmokeState | null>(null);
	const [signatureName, setSignatureName] = useState("Ada Lovelace");
	const [date, setDate] = useState("2026-05-20");
	const [message, setMessage] = useState<string | null>(null);

	async function runSetup() {
		setMessage("Creating envelope");
		const envelope = await postJson<{ id: string }>("/api/envelopes", undefined, {
			"x-internal-user-id": "manual-ui",
			"idempotency-key": `manual-ui-create-${crypto.randomUUID()}`,
		});
		const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n");
		await fetch(`/api/envelopes/${envelope.id}/source-pdf`, {
			method: "POST",
			headers: {
				"x-internal-user-id": "manual-ui",
				"idempotency-key": `manual-ui-upload-${crypto.randomUUID()}`,
				"content-type": "application/pdf",
			},
			body: pdf,
		});
		const recipients = await postJson<Array<{ id: string }>>(
			`/api/envelopes/${envelope.id}/recipients`,
			{ recipients: [{ name: "Ada Lovelace", email: "ada@example.com" }] },
			{ "x-internal-user-id": "manual-ui" },
		);
		const recipientId = recipients[0]?.id ?? "";
		await postJson(
			`/api/envelopes/${envelope.id}/fields`,
			{
				fields: [
					{ recipientId, type: "signature", page: 1, x: 72, y: 144, width: 180, height: 48 },
					{ recipientId, type: "date", page: 1, x: 300, y: 144, width: 120, height: 32 },
				],
			},
			{ "x-internal-user-id": "manual-ui" },
		);
		const sent = await postJson<{ signingLinks: SigningLink[] }>(
			`/api/envelopes/${envelope.id}/actions`,
			{ action: "send" },
			{ "x-internal-user-id": "manual-ui" },
		);
		setState({
			envelopeId: envelope.id,
			recipientId,
			signingLink: sent.signingLinks[0] ?? {
				recipientId,
				email: "ada@example.com",
				token: "",
				url: "",
			},
			finalPdfAvailable: false,
		});
		setMessage("Envelope sent");
	}

	async function completeInPage(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!state) return;
		await postJson(`/api/signing/${state.signingLink.token}/complete`, { signatureName, date });
		const status = await getJson<{ finalPdfAvailable: boolean }>(
			`/api/envelopes/${state.envelopeId}/status`,
		);
		setState({ ...state, finalPdfAvailable: status.finalPdfAvailable });
		setMessage(status.finalPdfAvailable ? "Final PDF is available" : "Signing complete");
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				<div>
					<h1 className="text-2xl font-semibold">Manual signing smoke test</h1>
					<p className="text-sm text-muted-foreground">
						Create, prepare, send, sign, and verify one envelope from the browser.
					</p>
				</div>
				<div className="rounded-md border p-4">
					<Button type="button" onClick={runSetup}>
						<Play className="h-4 w-4" />
						Run setup
					</Button>
				</div>
				{state && (
					<div className="grid gap-4 rounded-md border p-4">
						<div className="grid gap-2 text-sm">
							<p>
								Envelope: <span className="font-mono">{state.envelopeId}</span>
							</p>
							<a className="text-primary underline" href={state.signingLink.url}>
								{state.signingLink.url}
							</a>
						</div>
						<form onSubmit={completeInPage} className="grid gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="manual-signature-name">Typed signature</Label>
								<Input
									id="manual-signature-name"
									value={signatureName}
									onChange={(event) => setSignatureName(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="manual-signing-date">Signing date</Label>
								<Input
									id="manual-signing-date"
									type="date"
									value={date}
									onChange={(event) => setDate(event.target.value)}
								/>
							</div>
							<div className="flex items-end">
								<Button type="submit" className="w-full">
									<Send className="h-4 w-4" />
									Complete in page
								</Button>
							</div>
						</form>
						{state.finalPdfAvailable && (
							<a
								className="inline-flex items-center gap-2 text-primary underline"
								href={`/api/envelopes/${state.envelopeId}/final-pdf`}
							>
								<FileText className="h-4 w-4" />
								Download final PDF
							</a>
						)}
					</div>
				)}
				{message && (
					<p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<Check className="h-4 w-4" />
						{message}
					</p>
				)}
			</div>
		</div>
	);
}

async function postJson<T = unknown>(
	path: string,
	body?: unknown,
	headers: Record<string, string> = {},
): Promise<T> {
	const response = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const payload = (await response.json()) as { data: T };
	return payload.data;
}

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(path);
	const payload = (await response.json()) as { data: T };
	return payload.data;
}
