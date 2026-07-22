import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HistoryDocumentsPage } from "@/components/history/history-documents-page";

export const Route = createFileRoute("/my-documents/")({
	validateSearch: z.object({
		start: z.enum(["only_me", "me_and_another_signer"]).optional(),
	}),
	component: MyDocumentsIndexRoute,
});

function MyDocumentsIndexRoute() {
	const search = Route.useSearch();
	return <HistoryDocumentsPage initialSigningMode={search.start} />;
}
