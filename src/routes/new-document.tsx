import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HistorySigningStartPage } from "@/components/history/history-signing-start-page";

export const Route = createFileRoute("/new-document")({
	validateSearch: z.object({
		signingMode: z.enum(["only_me", "me_and_another_signer"]).default("only_me"),
	}),
	component: NewDocumentRoute,
});

function NewDocumentRoute() {
	const search = Route.useSearch();
	return <HistorySigningStartPage signingMode={search.signingMode} />;
}
