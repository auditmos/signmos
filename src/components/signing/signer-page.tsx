import { CheckCircle2, Download, FileText, MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";
import { pdfPage } from "@/components/envelopes/field-placement-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
	type CompleteSigningPayload,
	PartnerSignatureForm,
	type PartnerSignaturePreference,
} from "./partner-signature-form";

interface SignerField {
	id: string;
	type: "signature" | "date";
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface SignerPreviewField extends SignerField {
	recipientId: string;
	recipientName: string;
	value: string | null;
	assignedToCurrentSigner: boolean;
}

interface SignerSession {
	envelopeId: string;
	recipientId: string;
	sourceDocument: {
		version: number;
		contentType: "application/pdf";
		downloadUrl: string;
	};
	fields: SignerField[];
	previewFields?: SignerPreviewField[];
	signaturePreference: PartnerSignaturePreference | null;
}

interface CompletedDocumentLink {
	url: string;
	downloadUrl: string;
}

interface SigningError {
	message: string;
	verificationUrl?: string;
}

interface SignerPageProps {
	token: string;
}

export function SignerPage({ token }: SignerPageProps) {
	const [session, setSession] = useState<SignerSession | null>(null);
	const [completedDocument, setCompletedDocument] = useState<CompletedDocumentLink | null>(null);
	const [changeComment, setChangeComment] = useState("");
	const [reason, setReason] = useState("");
	const [comment, setComment] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<SigningError | null>(null);
	const [changeRequested, setChangeRequested] = useState(false);

	useEffect(() => {
		let active = true;
		fetch(`/api/signing/${token}`)
			.then(
				(response) =>
					response.json() as Promise<{
						data?: SignerSession | { completedDocument: CompletedDocumentLink };
						error?: SigningError;
					}>,
			)
			.then((body) => {
				if (!active) return;
				setError(body.error ?? null);
				if (body.data && "completedDocument" in body.data) {
					setCompletedDocument(body.data.completedDocument);
					setSession(null);
					return;
				}
				setCompletedDocument(null);
				setSession(body.data ?? null);
			});
		return () => {
			active = false;
		};
	}, [token]);

	async function completeSigning(payload: CompleteSigningPayload) {
		const response = await fetch(`/api/signing/${token}/complete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (response.ok) {
			setMessage("Signing complete");
			return;
		}
		const body = (await response.json().catch((): { error?: SigningError } => ({}))) as {
			error?: SigningError;
		};
		setMessage(body.error?.message ?? "Unable to complete signing");
	}

	async function declineSigning(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`/api/signing/${token}/decline`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason, comment: comment || undefined }),
		});
		setMessage(response.ok ? "Signing declined" : "Unable to decline");
	}

	async function requestChanges(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`/api/signing/${token}/change-request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ comment: changeComment }),
		});
		if (response.ok) setChangeRequested(true);
		setMessage(response.ok ? "Changes requested" : "Unable to request changes");
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			<div>
				<h1 className="text-balance text-2xl font-semibold">Review and sign</h1>
				<p className="text-pretty text-sm text-muted-foreground">
					No account is required for this signing link.
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
			{session?.sourceDocument && <SigningDocumentPreview session={session} />}
			{session && (
				<>
					<div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
						{session.fields.length === 0 ? (
							<div className="space-y-1 md:col-span-2">
								<p className="font-medium">No assigned fields</p>
								<p className="text-pretty text-sm text-muted-foreground">
									Request changes if this document is missing a signature or date field.
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
							<Button type="submit" variant="outline" className="w-full" disabled={changeRequested}>
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
			{message && <p className="text-sm text-muted-foreground">{message}</p>}
		</div>
	);
}

function SigningDocumentPreview({ session }: { session: SignerSession }) {
	const previewFields = signerPreviewFields(session);
	const pages = previewPages(previewFields);

	return (
		<section className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-base font-semibold">Source PDF</h2>
				<a
					className="inline-flex items-center gap-2 text-sm font-medium text-primary underline"
					href={session.sourceDocument.downloadUrl}
				>
					<FileText className="h-4 w-4" />
					Open source PDF
				</a>
			</div>
			<div className="grid gap-4">
				{pages.map((page, index) => (
					<div
						key={page}
						className="relative aspect-[612/792] w-full overflow-hidden rounded-md border bg-white"
					>
						<iframe
							className="absolute inset-0 h-full w-full bg-muted"
							src={pdfPreviewUrl(session.sourceDocument.downloadUrl, page)}
							title={index === 0 ? "Source PDF preview" : `Source PDF preview page ${page}`}
						/>
						<div className="pointer-events-none absolute inset-0">
							{previewFields
								.filter((field) => field.page === page)
								.map((field) => (
									<SigningPreviewFieldOverlay key={field.id} field={field} />
								))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function SigningPreviewFieldOverlay({ field }: { field: SignerPreviewField }) {
	const hasValue = Boolean(field.value?.trim());
	const style = {
		left: `${(field.x / pdfPage.width) * 100}%`,
		top: `${(field.y / pdfPage.height) * 100}%`,
		width: `${(field.width / pdfPage.width) * 100}%`,
		height: `${(field.height / pdfPage.height) * 100}%`,
	};
	return (
		<div
			aria-label={`${field.recipientName} ${field.type} ${hasValue ? "value" : "placeholder"}`}
			role="img"
			className={cn(
				"absolute flex overflow-hidden rounded border-2 px-2 text-slate-950 shadow-sm",
				hasValue ? "border-emerald-700 bg-white/90" : "border-blue-700 bg-blue-50/90",
				field.assignedToCurrentSigner && !hasValue && "border-dashed",
				field.height < 40 ? "items-center text-[10px]" : "flex-col justify-center text-xs",
			)}
			style={style}
		>
			{field.value ? (
				<PreviewFieldValue field={field} value={field.value} />
			) : (
				<>
					<span className="truncate font-medium capitalize">{field.type} here</span>
					<span className="truncate">{field.recipientName}</span>
				</>
			)}
		</div>
	);
}

function PreviewFieldValue({ field, value }: { field: SignerPreviewField; value: string }) {
	if (field.type === "signature" && looksLikeSvgPath(value)) {
		return (
			<svg aria-hidden="true" className="h-full w-full" viewBox="0 0 320 128">
				<path d={value} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
			</svg>
		);
	}
	return (
		<>
			<span className="truncate font-medium">{value}</span>
			<span className="truncate text-[10px]">{field.recipientName}</span>
		</>
	);
}

function signerPreviewFields(session: SignerSession): SignerPreviewField[] {
	if (session.previewFields?.length) return session.previewFields;
	return session.fields.map((field) => ({
		...field,
		recipientId: session.recipientId,
		recipientName: "Signer",
		value: null,
		assignedToCurrentSigner: true,
	}));
}

function previewPages(fields: SignerPreviewField[]): number[] {
	const pages = [...new Set(fields.map((field) => field.page))].sort((left, right) => left - right);
	return pages.length > 0 ? pages : [1];
}

function pdfPreviewUrl(downloadUrl: string, page: number): string {
	return `${downloadUrl}#toolbar=0&navpanes=0&scrollbar=0&page=${page}`;
}

function looksLikeSvgPath(value: string): boolean {
	return /^[MmLlHhVvCcSsQqTtAaZz0-9,.\s-]+$/.test(value.trim());
}
