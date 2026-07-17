import { createFileRoute } from "@tanstack/react-router";
import { HistoryCreatorPage } from "@/components/history/history-creator-page";

export const Route = createFileRoute("/my-documents/$envelopeId/manage")({
	component: HistoryCreatorRoute,
});

function HistoryCreatorRoute() {
	const { envelopeId } = Route.useParams();
	return <HistoryCreatorPage envelopeId={envelopeId} />;
}
