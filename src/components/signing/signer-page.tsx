import { CheckCircle2, Download, FileText, MessageSquare, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { pdfPage } from "@/components/envelopes/field-placement-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type CompleteSigningPayload, PartnerSignatureForm } from "./partner-signature-form";
import {
	type SignerField,
	type SignerPreviewField,
	type SignerSession,
	SigningDocumentPreview,
} from "./signing-document-preview";

interface CompletedDocumentLink {
	url: string;
	downloadUrl: string;
}

interface SigningError {
	message: string;
	verificationUrl?: string;
}

type SignerPageProps = { token: string } | { historyEnvelopeId: string };

export function SignerPage(props: SignerPageProps) {
	const historyMode = "historyEnvelopeId" in props;
	const endpoint = historyMode
		? `/api/history/documents/${encodeURIComponent(props.historyEnvelopeId)}/signing`
		: `/api/signing/${encodeURIComponent(props.token)}`;
	const [session, setSession] = useState<SignerSession | null>(null);
	const [completedDocument, setCompletedDocument] = useState<CompletedDocumentLink | null>(null);
	const [changeComment, setChangeComment] = useState("");
	const [reason, setReason] = useState("");
	const [comment, setComment] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<SigningError | null>(null);
	const [changeRequested, setChangeRequested] = useState(false);
	const dragRef = useRef<{ fieldId: string; offsetX: number; offsetY: number } | null>(null);

	const refreshSigningState = useCallback(
		async (isActive: () => boolean = () => true) => {
			const response = await fetch(endpoint);
			const body = (await response.json()) as {
				data?: SignerSession | { completedDocument: CompletedDocumentLink };
				error?: SigningError;
			};
			if (!isActive()) return;
			setError(body.error ?? null);
			if (body.data && "completedDocument" in body.data) {
				setCompletedDocument(body.data.completedDocument);
				setSession(null);
				return;
			}
			setCompletedDocument(null);
			setSession(body.data ?? null);
		},
		[endpoint],
	);

	useEffect(() => {
		let active = true;
		void refreshSigningState(() => active);
		return () => {
			active = false;
		};
	}, [refreshSigningState]);

	async function completeSigning(payload: CompleteSigningPayload) {
		const response = await fetch(`${endpoint}/complete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (response.ok) {
			setMessage("Signing complete");
			await refreshSigningState();
			return;
		}
		const body = (await response.json().catch((): { error?: SigningError } => ({}))) as {
			error?: SigningError;
		};
		setMessage(body.error?.message ?? "Unable to complete signing");
	}

	async function declineSigning(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`${endpoint}/decline`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason, comment: comment || undefined }),
		});
		setMessage(response.ok ? "Signing declined" : "Unable to decline");
		if (response.ok && historyMode) await refreshSigningState();
	}

	async function requestChanges(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`${endpoint}/change-request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ comment: changeComment }),
		});
		if (response.ok) setChangeRequested(true);
		setMessage(response.ok ? "Changes requested" : "Unable to request changes");
		if (response.ok && historyMode) await refreshSigningState();
	}

	function startFieldDrag(
		event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
		field: SignerPreviewField,
	) {
		const page = event.currentTarget.closest("[data-signing-pdf-page]");
		if (!(page instanceof HTMLElement)) return;
		const point = pointFromPreview(event, page);
		dragRef.current = {
			fieldId: field.id,
			offsetX: point.x - field.x,
			offsetY: point.y - field.y,
		};
		if ("pointerId" in event) event.currentTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}

	function continueFieldDrag(
		event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
	) {
		const drag = dragRef.current;
		if (!drag) return;
		const field = session?.fields.find((candidate) => candidate.id === drag.fieldId);
		if (!session || !field) return;
		const point = pointFromPreview(event, event.currentTarget);
		const nextField = {
			...field,
			x: clamp(Math.round(point.x - drag.offsetX), 0, pdfPage.width - field.width),
			y: clamp(Math.round(point.y - drag.offsetY), 0, pdfPage.height - field.height),
		};
		setSession(moveSessionField(session, nextField));
	}

	async function stopFieldDrag() {
		const drag = dragRef.current;
		if (!drag) return;
		dragRef.current = null;
		const field = session?.fields.find((candidate) => candidate.id === drag.fieldId);
		if (!field || session?.signingMode !== "only_me") return;
		const response = await fetch(`${endpoint}/fields/${field.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ page: field.page, x: field.x, y: field.y }),
		});
		if (!response.ok) {
			setMessage("Unable to move placeholder");
			await refreshSigningState();
		}
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			<div>
				<h1 className="text-balance text-2xl font-semibold">Review and sign</h1>
				<p className="text-pretty text-sm text-muted-foreground">
					{historyMode
						? "Your verified My documents session protects this signing task."
						: "No account is required for this signing link."}
				</p>
			</div>
			{error && (
				<div className="rounded-md border border-destructive/40 p-4 text-sm">
					<p className="font-medium">{error.message}</p>
					{error.verificationUrl && (
						<a className="text-primary underline" href={error.verificationUrl}>
							Verify email
						</a>
					)}
				</div>
			)}
			{completedDocument && (
				<section className="rounded-md border p-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="inline-flex items-center gap-2 font-medium">
								<CheckCircle2 className="h-4 w-4 text-emerald-700" />
								Document complete
							</p>
							<p className="text-sm text-muted-foreground">
								The final document is ready for review and download.
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<a
								className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium"
								href={completedDocument.url}
							>
								<FileText className="h-4 w-4" />
								View completed document
							</a>
							<a
								className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
								href={completedDocument.downloadUrl}
							>
								<Download className="h-4 w-4" />
								Download final PDF
							</a>
						</div>
					</div>
				</section>
			)}
			{!session && !error && !completedDocument && (
				<div className="rounded-md border p-4 text-sm text-muted-foreground">
					<p className="font-medium text-foreground">Loading signing session</p>
					<p className="text-pretty">Fetching the document and assigned signing fields.</p>
				</div>
			)}
			{session?.sourceDocument && (
				<SigningDocumentPreview
					session={session}
					canDragFields={session.signingMode === "only_me"}
					onStartFieldDrag={startFieldDrag}
					onContinueFieldDrag={continueFieldDrag}
					onStopFieldDrag={stopFieldDrag}
				/>
			)}
			{session && (
				<>
					<div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
						{session.fields.length === 0 ? (
							<div className="space-y-1 md:col-span-2">
								<p className="font-medium">No assigned fields</p>
								<p className="text-pretty text-sm text-muted-foreground">
									{session.signingMode === "only_me"
										? "This signing link has no signature or date fields assigned."
										: "Request changes if this document is missing a signature or date field."}
								</p>
							</div>
						) : (
							session.fields.map((field) => (
								<div key={field.id} className="rounded-md border bg-muted/30 p-3">
									<p className="font-medium capitalize">{field.type}</p>
									<p className="text-sm text-muted-foreground">
										Page {field.page}, x {field.x}, y {field.y}, {field.width}x{field.height}
									</p>
								</div>
							))
						)}
					</div>
					<PartnerSignatureForm
						key={session.signaturePreference?.id ?? "new-partner-signature"}
						initialPreference={session.signaturePreference}
						disabled={changeRequested || session.fields.length === 0}
						onSubmit={completeSigning}
					/>
					{session.signingMode !== "only_me" && (
						<>
							<form onSubmit={requestChanges} className="grid gap-4 md:grid-cols-3">
								<div className="space-y-2 md:col-span-2">
									<Label htmlFor="changeComment">Change request comment</Label>
									<Input
										id="changeComment"
										value={changeComment}
										onChange={(event) => setChangeComment(event.target.value)}
										required
									/>
								</div>
								<div className="flex items-end">
									<Button
										type="submit"
										variant="outline"
										className="w-full"
										disabled={changeRequested}
									>
										<MessageSquare className="h-4 w-4" />
										Request changes
									</Button>
								</div>
							</form>
							<form onSubmit={declineSigning} className="grid gap-4 md:grid-cols-3">
								<div className="space-y-2">
									<Label htmlFor="declineReason">Decline reason</Label>
									<Input
										id="declineReason"
										value={reason}
										onChange={(event) => setReason(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="declineComment">Comment</Label>
									<Input
										id="declineComment"
										value={comment}
										onChange={(event) => setComment(event.target.value)}
									/>
								</div>
								<div className="flex items-end">
									<Button type="submit" variant="outline" className="w-full">
										<X className="h-4 w-4" />
										Decline
									</Button>
								</div>
							</form>
						</>
					)}
				</>
			)}
			{message && <p className="text-sm text-muted-foreground">{message}</p>}
		</div>
	);
}

function moveSessionField(session: SignerSession, nextField: SignerField): SignerSession {
	return {
		...session,
		fields: session.fields.map((field) => (field.id === nextField.id ? nextField : field)),
		previewFields: session.previewFields?.map((field) =>
			field.id === nextField.id ? { ...field, ...nextField } : field,
		),
	};
}

function pointFromPreview(
	event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
	preview: HTMLElement,
): { x: number; y: number } {
	const bounds = preview.getBoundingClientRect();
	if (bounds.width <= 0 || bounds.height <= 0) return { x: event.clientX, y: event.clientY };
	return {
		x: (event.clientX - bounds.left) * (pdfPage.width / bounds.width),
		y: (event.clientY - bounds.top) * (pdfPage.height / bounds.height),
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
