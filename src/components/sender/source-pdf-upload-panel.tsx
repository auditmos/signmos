import { FileUp } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SourcePdfUploadPanelProps {
	envelopeId: string;
	senderSessionToken: string;
}

type UploadState =
	| { status: "idle" }
	| { status: "uploading" }
	| { status: "success"; document: SourceDocumentResponse }
	| { status: "error"; message: string };

type SourceDocumentResponse = {
	id: string;
	envelopeId: string;
	r2Key: string;
	version: number;
	sha256: string;
	byteSize: number;
	contentType: "application/pdf";
	uploadedBy: string;
	uploadedAt: string;
};

type UploadSuccess = { data: SourceDocumentResponse };
type UploadError = { error: { message: string } };

export function SourcePdfUploadPanel({
	envelopeId,
	senderSessionToken,
}: SourcePdfUploadPanelProps) {
	const [file, setFile] = useState<File | null>(null);
	const [state, setState] = useState<UploadState>({ status: "idle" });
	const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

	async function submitUpload(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!file) {
			setState({ status: "error", message: "Choose a PDF before uploading" });
			return;
		}

		setState({ status: "uploading" });
		const response = await fetch(`/api/envelopes/${envelopeId}/source-pdf`, {
			method: "POST",
			headers: {
				"content-type": file.type || "application/pdf",
				"idempotency-key": idempotencyKey,
				"x-sender-session-token": senderSessionToken,
			},
			body: file,
		});
		const json: unknown = await response.json().catch(() => null);
		if (!response.ok || !isUploadSuccess(json)) {
			const message = isUploadError(json) ? json.error.message : "Unable to upload the PDF";
			setState({ status: "error", message });
			return;
		}

		setState({ status: "success", document: json.data });
	}

	return (
		<form
			aria-label="Upload source PDF"
			className="rounded-lg border bg-card p-5"
			onSubmit={submitUpload}
		>
			<div className="space-y-5">
				<div className="space-y-2">
					<Label htmlFor="source-pdf">Source PDF</Label>
					<Input
						id="source-pdf"
						type="file"
						accept="application/pdf"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					/>
				</div>

				{state.status === "error" ? (
					<Alert variant="destructive" role="alert">
						<AlertTitle>Upload failed</AlertTitle>
						<AlertDescription>{state.message}</AlertDescription>
					</Alert>
				) : null}

				{state.status === "success" ? (
					<Alert>
						<AlertTitle>PDF uploaded</AlertTitle>
						<AlertDescription>
							Version {state.document.version} · {state.document.byteSize} bytes ·{" "}
							<span className="font-mono tabular-nums">{state.document.sha256}</span>
						</AlertDescription>
					</Alert>
				) : null}

				<Button type="submit" disabled={state.status === "uploading"}>
					<FileUp className="mr-2 size-4" />
					{state.status === "uploading" ? "Uploading..." : "Upload PDF"}
				</Button>
			</div>
		</form>
	);
}

function isUploadSuccess(value: unknown): value is UploadSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "sha256" in data);
}

function isUploadError(value: unknown): value is UploadError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}
