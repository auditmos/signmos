import { createFileRoute, useLocation } from "@tanstack/react-router";
import { HistoryAccessConfirmationPage } from "@/components/history/history-access-confirmation-page";

export const Route = createFileRoute("/history-access/$credential")({
	component: HistoryAccessConfirmationRoute,
});

function HistoryAccessConfirmationRoute() {
	const { credential } = Route.useParams();
	const searchString = useLocation({ select: (location) => location.searchStr });
	const candidate = new URLSearchParams(searchString).get("returnTo");
	const returnTo =
		candidate && /^\/human-review\/[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate)
			? candidate
			: undefined;
	return <HistoryAccessConfirmationPage credential={credential} returnTo={returnTo} />;
}
