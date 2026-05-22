import { createFileRoute } from "@tanstack/react-router";
import { CompletedDocumentPage } from "@/components/completed-documents/completed-document-page";

export const Route = createFileRoute("/completed-documents/$token")({
	component: CompletedDocumentRoute,
});

function CompletedDocumentRoute() {
	const { token } = Route.useParams();
	return <CompletedDocumentPage token={token} />;
}
