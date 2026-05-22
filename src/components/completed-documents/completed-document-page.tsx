import { CheckCircle2, Download, FileText, History, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface CompletedDocumentView {
	token: string;
	envelopeId: string;
	status: "completed";
	finalPdf: {
		downloadUrl: string;
		contentType: "application/pdf";
		byteSize: number;
		sha256: string;
		createdAt: string | null;
	};
	parties: Array<{
		id: string;
		name: string;
		email: string;
		status: string;
		signedDate: string | null;
		signedAt: string | null;
	}>;
	history: Array<{
		type: string;
		title: string;
		detail: string | null;
		occurredAt: string;
	}>;
}

interface CompletedDocumentPageProps {
	token: string;
}

export function CompletedDocumentPage({ token }: CompletedDocumentPageProps) {
	const [view, setView] = useState<CompletedDocumentView | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		fetch(`/api/final-documents/${token}`)
			.then(async (response) => {
				const body = (await response.json()) as {
					data?: CompletedDocumentView;
					error?: { message?: string };
				};
				if (!active) return;
				if (response.ok && body.data) {
					setView(body.data);
					setError(null);
					return;
				}
				setError(body.error?.message ?? "Completed document is not available");
			})
			.catch(() => {
				if (active) setError("Completed document is not available");
			});
		return () => {
			active = false;
		};
	}, [token]);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
				<header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
					<div className="space-y-2">
						<div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
							<CheckCircle2 className="h-4 w-4" />
							Completed
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">Completed document</h1>
						{view && (
							<p className="break-all text-sm text-muted-foreground">Envelope {view.envelopeId}</p>
						)}
					</div>
					{view && (
						<a
							className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
							href={view.finalPdf.downloadUrl}
						>
							<Download className="h-4 w-4" />
							Download final PDF
						</a>
					)}
				</header>

				{!view && !error && (
					<section className="rounded-md border p-4 text-sm text-muted-foreground">
						<p className="font-medium text-foreground">Loading completed document</p>
						<p>Fetching final document details.</p>
					</section>
				)}

				{error && (
					<section className="rounded-md border border-destructive/40 p-4 text-sm">
						<p className="font-medium">{error}</p>
					</section>
				)}

				{view && (
					<>
						<section className="grid gap-4 border-b pb-6 md:grid-cols-3">
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Final status</p>
								<p className="text-lg font-semibold capitalize">{view.status}</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Final PDF</p>
								<p className="inline-flex items-center gap-2 text-sm">
									<FileText className="h-4 w-4" />
									{formatBytes(view.finalPdf.byteSize)}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Document hash</p>
								<p className="break-all font-mono text-xs">{view.finalPdf.sha256}</p>
							</div>
						</section>

						<section className="space-y-4">
							<div className="flex items-center gap-2">
								<Users className="h-4 w-4" />
								<h2 className="text-base font-semibold">Party summary</h2>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								{view.parties.map((party) => (
									<div key={party.id} className="rounded-md border p-4">
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="font-medium">{party.name}</p>
												<p className="break-all text-sm text-muted-foreground">{party.email}</p>
											</div>
											<span className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
												{titleCase(party.status)}
											</span>
										</div>
										<p className="mt-3 text-sm text-muted-foreground">
											Signed date {party.signedDate ?? "not recorded"}
										</p>
									</div>
								))}
							</div>
						</section>

						<section className="space-y-4">
							<div className="flex items-center gap-2">
								<History className="h-4 w-4" />
								<h2 className="text-base font-semibold">History</h2>
							</div>
							<ol className="space-y-3">
								{view.history.map((event) => (
									<li key={`${event.type}-${event.occurredAt}`} className="rounded-md border p-4">
										<p className="font-medium">{event.title}</p>
										<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
											<time dateTime={event.occurredAt}>{event.occurredAt}</time>
											{event.detail && <span>{event.detail}</span>}
										</div>
									</li>
								))}
							</ol>
						</section>
					</>
				)}
			</div>
		</div>
	);
}

function formatBytes(value: number): string {
	return `${value.toLocaleString("en-US")} bytes`;
}

function titleCase(value: string): string {
	return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value;
}
