import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, History } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type DocumentHistoryState = "draft" | "in_progress" | "completed";
type HistoryFilter = DocumentHistoryState | "all";

interface DocumentHistoryPanelProps {
	envelopeId: string;
	senderSessionToken: string;
}

interface DocumentHistoryResponse {
	email: string;
	windowStart: string;
	windowDays: number;
	documents: DocumentHistoryItem[];
}

interface DocumentHistoryItem {
	envelopeId: string;
	title: string;
	status: string;
	state: DocumentHistoryState;
	documentType: "self_signed" | "signed_with_partner";
	role: string;
	createdAt: string;
	action: DocumentHistoryAction | null;
}

interface DocumentHistoryAction {
	type: "resume" | "completed";
	label: string;
	url: string;
	downloadUrl?: string;
}

type HistorySuccess = { data: DocumentHistoryResponse };
type HistoryError = { error: { message: string } };

export function DocumentHistoryPanel({
	envelopeId,
	senderSessionToken,
}: DocumentHistoryPanelProps) {
	const [expanded, setExpanded] = useState(false);
	const [filter, setFilter] = useState<HistoryFilter>("all");
	const historyQuery = useQuery({
		queryKey: ["document-history", envelopeId, senderSessionToken],
		queryFn: () => fetchDocumentHistory(envelopeId, senderSessionToken),
		enabled: expanded && Boolean(envelopeId && senderSessionToken),
		staleTime: 30_000,
	});
	const documents = historyQuery.data?.documents ?? [];
	const visibleDocuments =
		filter === "all" ? documents : documents.filter((document) => document.state === filter);

	return (
		<section className="rounded-lg border bg-card p-5" aria-label="Document history">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="flex items-center gap-2 font-semibold text-lg">
						<History className="size-5 text-muted-foreground" />
						Document history
					</h2>
					<p className="text-muted-foreground text-sm">
						Documents linked to the confirmed email from the last 30 days.
					</p>
				</div>
				<Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)}>
					{expanded ? "Hide document history" : "Show document history"}
				</Button>
			</div>

			{expanded ? (
				<div className="mt-5 space-y-4">
					{historyQuery.isLoading ? (
						<p className="text-muted-foreground text-sm">Loading document history.</p>
					) : null}
					{historyQuery.error instanceof Error ? (
						<Alert variant="destructive" role="alert">
							<AlertTitle>History failed</AlertTitle>
							<AlertDescription>{historyQuery.error.message}</AlertDescription>
						</Alert>
					) : null}
					{historyQuery.data ? (
						<>
							<HistoryFilterControl value={filter} onChange={setFilter} />
							<DocumentHistoryTable documents={visibleDocuments} />
						</>
					) : null}
				</div>
			) : null}
		</section>
	);
}

function HistoryFilterControl({
	value,
	onChange,
}: {
	value: HistoryFilter;
	onChange: (value: HistoryFilter) => void;
}) {
	return (
		<div className="flex flex-col gap-2 sm:max-w-64">
			<Label htmlFor="document-history-filter">State</Label>
			<select
				id="document-history-filter"
				aria-label="Filter document history by state"
				className="h-10 rounded-md border bg-background px-3 text-sm"
				value={value}
				onChange={(event) => onChange(event.target.value as HistoryFilter)}
			>
				<option value="all">All states</option>
				<option value="draft">Draft</option>
				<option value="in_progress">In progress</option>
				<option value="completed">Completed</option>
			</select>
		</div>
	);
}

function DocumentHistoryTable({ documents }: { documents: DocumentHistoryItem[] }) {
	if (documents.length === 0) {
		return <p className="text-muted-foreground text-sm">No documents match this filter.</p>;
	}

	return (
		<div className="overflow-x-auto">
			<table
				className="w-full min-w-[720px] text-left text-sm"
				aria-label="Confirmed email document history"
			>
				<thead className="border-b text-muted-foreground">
					<tr>
						<th className="py-3 pr-4 font-medium">Document</th>
						<th className="py-3 pr-4 font-medium">Type</th>
						<th className="py-3 pr-4 font-medium">State</th>
						<th className="py-3 pr-4 font-medium">Created</th>
						<th className="py-3 pr-4 font-medium">Action</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{documents.map((document) => (
						<tr key={document.envelopeId}>
							<td className="py-3 pr-4 align-top">
								<p className="font-medium">{document.title}</p>
								<p className="text-muted-foreground text-xs">{formatRole(document.role)}</p>
							</td>
							<td className="py-3 pr-4 align-top">{formatDocumentType(document.documentType)}</td>
							<td className="py-3 pr-4 align-top">
								<span className="rounded-md bg-muted px-2 py-1 text-xs">{document.status}</span>
							</td>
							<td className="py-3 pr-4 align-top">
								<time dateTime={document.createdAt}>{formatDate(document.createdAt)}</time>
							</td>
							<td className="py-3 pr-4 align-top">
								<DocumentHistoryActions action={document.action} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DocumentHistoryActions({ action }: { action: DocumentHistoryAction | null }) {
	if (!action) return <span className="text-muted-foreground text-sm">No action available</span>;
	return (
		<div className="flex flex-wrap gap-2">
			<Button asChild size="sm">
				<a href={action.url}>
					{action.label}
					<ArrowRight className="size-4" />
				</a>
			</Button>
			{action.type === "completed" && action.downloadUrl ? (
				<Button asChild size="sm" variant="outline">
					<a href={action.downloadUrl}>
						<Download className="size-4" />
						Download PDF
					</a>
				</Button>
			) : null}
		</div>
	);
}

async function fetchDocumentHistory(
	envelopeId: string,
	senderSessionToken: string,
): Promise<DocumentHistoryResponse> {
	const response = await fetch(`/api/envelopes/${envelopeId}/history`, {
		headers: { "x-sender-session-token": senderSessionToken },
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isHistorySuccess(json)) {
		const message = isHistoryError(json) ? json.error.message : "Unable to load document history";
		throw new Error(message);
	}
	return json.data;
}

function formatDocumentType(type: DocumentHistoryItem["documentType"]): string {
	return type === "self_signed" ? "Self-signed" : "Signed with partner";
}

function formatRole(role: string): string {
	if (role === "creator_and_signer") return "Creator and signer";
	if (role === "creator") return "Creator";
	return "Signer";
}

function formatDate(value: string): string {
	return value.slice(0, 10);
}

function isHistorySuccess(value: unknown): value is HistorySuccess {
	if (!isRecord(value) || !isRecord(value.data)) return false;
	return Array.isArray(value.data.documents);
}

function isHistoryError(value: unknown): value is HistoryError {
	if (!isRecord(value) || !isRecord(value.error)) return false;
	return typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object");
}
