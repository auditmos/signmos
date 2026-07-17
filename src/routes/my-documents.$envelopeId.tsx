import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-documents/$envelopeId")({
	component: HistoryDocumentRoute,
});

function HistoryDocumentRoute() {
	return <Outlet />;
}
