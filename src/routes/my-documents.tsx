import { createFileRoute } from "@tanstack/react-router";
import { HistoryDocumentsPage } from "@/components/history/history-documents-page";

export const Route = createFileRoute("/my-documents")({
	component: HistoryDocumentsPage,
});
