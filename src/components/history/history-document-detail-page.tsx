import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface HistoryDocumentDetailPageProps {
	envelopeId: string;
}

interface HistoryDocumentDetail {
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
	history: Array<{ type: string; title: string; detail: string | null; occurredAt: string }>;
}

interface HistoryDocumentDetailResponse {
	data: HistoryDocumentDetail;
}

export function HistoryDocumentDetailPage({ envelopeId }: HistoryDocumentDetailPageProps) {
	const detailQuery = useQuery({
		queryKey: ["history-document", envelopeId],
		queryFn: async () => {
			const response = await fetch(`/api/history/documents/${encodeURIComponent(envelopeId)}`, {
				credentials: "same-origin",
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isHistoryDocumentDetailResponse(body)) {
				throw new Error("Unable to load completed document");
			}
			return body.data;
		},
	});

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-3xl space-y-6">
				<a
					className="rounded-sm text-primary text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					href="/my-documents"
				>
					Back to My documents
				</a>
				<h1 className="text-3xl font-semibold text-foreground">Completed document</h1>
				{detailQuery.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Loading completed document…
					</output>
				) : null}
				{detailQuery.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Document unavailable</AlertTitle>
						<AlertDescription>Return to My documents and try again.</AlertDescription>
					</Alert>
				) : null}
				{detailQuery.data ? (
					<>
						<p className="text-muted-foreground">Status: Completed</p>
						<a
							className="inline-flex rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							href={detailQuery.data.finalPdf.downloadUrl}
						>
							Download signed PDF
						</a>
						<section aria-labelledby="history-parties-heading" className="space-y-3">
							<h2 id="history-parties-heading" className="text-xl font-semibold text-foreground">
								Parties
							</h2>
							<ul className="grid gap-3">
								{detailQuery.data.parties.map((party) => (
									<li key={party.id} className="rounded-lg border bg-card p-4">
										<p className="font-medium text-foreground">{party.name}</p>
										<p className="text-muted-foreground text-sm">{party.email}</p>
									</li>
								))}
							</ul>
						</section>
					</>
				) : null}
			</section>
		</main>
	);
}

function isHistoryDocumentDetailResponse(value: unknown): value is HistoryDocumentDetailResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(
		data &&
			typeof data === "object" &&
			"envelopeId" in data &&
			"finalPdf" in data &&
			"parties" in data,
	);
}
