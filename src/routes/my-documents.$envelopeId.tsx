import { createFileRoute } from "@tanstack/react-router";
import { HistoryDocumentDetailPage } from "@/components/history/history-document-detail-page";

export const Route = createFileRoute("/my-documents/$envelopeId")({
	component: HistoryDocumentDetailRoute,
});

function HistoryDocumentDetailRoute() {
	const { envelopeId } = Route.useParams();
	return <HistoryDocumentDetailPage envelopeId={envelopeId} />;
}
