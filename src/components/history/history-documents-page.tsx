import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface HistoryDocumentRow {
	envelopeId: string;
	status: "completed";
	role: "creator" | "signer" | "creator_and_signer";
	detailUrl: string;
	downloadUrl: string;
}

interface HistoryDocumentsResponse {
	data: { documents: HistoryDocumentRow[] };
}

export function HistoryDocumentsPage() {
	const documentsQuery = useQuery({
		queryKey: ["history-documents"],
		queryFn: async () => {
			const response = await fetch("/api/history/documents", { credentials: "same-origin" });
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isHistoryDocumentsResponse(body)) {
				throw new Error("Unable to load My documents");
			}
			return body.data.documents;
		},
	});

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-3xl space-y-6">
				<div>
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-3 text-3xl font-semibold text-foreground">My documents</h1>
				</div>

				{documentsQuery.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Loading your documents…
					</output>
				) : null}
				{documentsQuery.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Unable to load My documents</AlertTitle>
						<AlertDescription>Request a new secure link and try again.</AlertDescription>
					</Alert>
				) : null}
				{documentsQuery.data?.length === 0 ? (
					<output className="block text-muted-foreground">
						No completed documents are available in this tracer yet.
					</output>
				) : null}
				<ul className="grid gap-4">
					{documentsQuery.data?.map((document) => (
						<li key={document.envelopeId}>
							<article className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
								<h2 className="font-semibold text-foreground">Completed document</h2>
								<p className="text-muted-foreground text-sm">
									<span className="font-medium text-foreground">Completed</span> ·{" "}
									{historyRoleLabel(document.role)}
								</p>
								<div className="flex flex-wrap gap-4 text-sm">
									<a
										className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										href={document.detailUrl}
									>
										View details
									</a>
									<a
										className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										href={document.downloadUrl}
									>
										Download PDF
									</a>
								</div>
							</article>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}

function historyRoleLabel(role: HistoryDocumentRow["role"]): string {
	if (role === "creator_and_signer") return "Creator and signer";
	return role === "creator" ? "Creator" : "Signer";
}

function isHistoryDocumentsResponse(value: unknown): value is HistoryDocumentsResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "documents" in data);
}
