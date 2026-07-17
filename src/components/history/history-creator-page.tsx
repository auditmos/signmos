import { useQuery } from "@tanstack/react-query";
import { SourcePdfUploadPanel } from "@/components/sender/source-pdf-upload-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface HistoryCreatorView {
	envelopeId: string;
	status: string;
	signingMode: "only_me" | "me_and_another_signer";
	sender: { name: string; email: string };
	allowedActions: string[];
	resumeUrl: string;
}

export function HistoryCreatorPage({ envelopeId }: { envelopeId: string }) {
	const creatorQuery = useQuery({
		queryKey: ["history-creator", envelopeId],
		queryFn: () => fetchHistoryCreator(envelopeId),
		retry: false,
	});
	const view = creatorQuery.data;
	const preparing = view?.status === "draft" || view?.status === "changes_requested";

	return (
		<main className="min-h-dvh bg-background p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				<a className="text-primary text-sm underline" href="/my-documents">
					Back to My documents
				</a>
				<div>
					<h1 className="text-2xl font-semibold">
						{preparing ? "Resume document" : "Review document"}
					</h1>
					{view ? (
						<p className="text-muted-foreground text-sm">
							Status: {historyCreatorStatus(view.status)}
						</p>
					) : null}
				</div>
				{creatorQuery.isPending ? <p aria-live="polite">Loading creator access…</p> : null}
				{creatorQuery.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Creator access unavailable</AlertTitle>
						<AlertDescription>
							Return to My documents and refresh the current status.
						</AlertDescription>
					</Alert>
				) : null}
				{view && preparing ? (
					<SourcePdfUploadPanel
						envelopeId={view.envelopeId}
						senderSessionToken=""
						historyAccess
						senderName={view.sender.name}
						senderEmail={view.sender.email}
						signingMode={view.signingMode}
					/>
				) : null}
				{view && !preparing ? (
					<section className="rounded-lg border p-5">
						<h2 className="font-semibold">Current creator actions</h2>
						<p className="text-muted-foreground text-sm">
							{view.allowedActions.length > 0
								? view.allowedActions.join(", ")
								: "No creator action is available."}
						</p>
					</section>
				) : null}
			</div>
		</main>
	);
}

async function fetchHistoryCreator(envelopeId: string): Promise<HistoryCreatorView> {
	const response = await fetch(`/api/history/documents/${encodeURIComponent(envelopeId)}/creator`, {
		credentials: "same-origin",
	});
	const body = (await response.json().catch(() => null)) as { data?: HistoryCreatorView } | null;
	if (!response.ok || !body?.data) throw new Error("Creator access unavailable");
	return body.data;
}

function historyCreatorStatus(status: string): string {
	return status.replaceAll("_", " ");
}
