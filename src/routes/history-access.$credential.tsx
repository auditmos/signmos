import { createFileRoute } from "@tanstack/react-router";
import { HistoryAccessConfirmationPage } from "@/components/history/history-access-confirmation-page";

export const Route = createFileRoute("/history-access/$credential")({
	component: HistoryAccessConfirmationRoute,
});

function HistoryAccessConfirmationRoute() {
	const { credential } = Route.useParams();
	return <HistoryAccessConfirmationPage credential={credential} />;
}
