import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, Download, History, Trash2 } from "lucide-react";
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
	creatorActions: DocumentHistoryCreatorAction[];
}

interface DocumentHistoryAction {
	type: "resume" | "completed";
	label: string;
	url: string;
	downloadUrl?: string;
}

interface DocumentHistoryCreatorAction {
	action: "cancel" | "delete";
	label: string;
}

interface PendingCreatorAction {
	envelopeId: string;
	action: "cancel" | "delete";
}

type HistorySuccess = { data: DocumentHistoryResponse };
type HistoryError = { error: { message: string } };

export function DocumentHistoryPanel({
	envelopeId,
	senderSessionToken,
}: DocumentHistoryPanelProps) {
	const [expanded, setExpanded] = useState(false);
	const [filter, setFilter] = useState<HistoryFilter>("all");
	const queryClient = useQueryClient();
	const queryKey = ["document-history", envelopeId, senderSessionToken] as const;
	const historyQuery = useQuery({
		queryKey,
		queryFn: () => fetchDocumentHistory(envelopeId, senderSessionToken),
		enabled: expanded && Boolean(envelopeId && senderSessionToken),
		staleTime: 30_000,
	});
	const controlMutation = useMutation({
		mutationFn: (input: PendingCreatorAction) => runCreatorAction(input, senderSessionToken),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey });
		},
	});

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
				<ExpandedDocumentHistory
					data={historyQuery.data ?? null}
					isLoading={historyQuery.isLoading}
					historyError={historyQuery.error}
					controlError={controlMutation.error}
					filter={filter}
					onFilterChange={setFilter}
					pendingAction={controlMutation.variables ?? null}
					isActionPending={controlMutation.isPending}
					onCreatorAction={(input) => controlMutation.mutate(input)}
				/>
			) : null}
		</section>
	);
}

function ExpandedDocumentHistory({
	data,
	isLoading,
	historyError,
	controlError,
	filter,
	onFilterChange,
	pendingAction,
	isActionPending,
	onCreatorAction,
}: {
	data: DocumentHistoryResponse | null;
	isLoading: boolean;
	historyError: unknown;
	controlError: unknown;
	filter: HistoryFilter;
	onFilterChange: (value: HistoryFilter) => void;
	pendingAction: PendingCreatorAction | null;
	isActionPending: boolean;
	onCreatorAction: (input: PendingCreatorAction) => void;
}) {
	const documents = data?.documents ?? [];
	const visibleDocuments =
		filter === "all" ? documents : documents.filter((document) => document.state === filter);
	const historyMessage = historyError instanceof Error ? historyError.message : null;
	const controlMessage = controlError instanceof Error ? controlError.message : null;

	return (
		<div className="mt-5 space-y-4">
			{isLoading ? (
				<p className="text-muted-foreground text-sm">Loading document history.</p>
			) : null}
			{historyMessage ? (
				<HistoryErrorAlert title="History failed" message={historyMessage} />
			) : null}
			{controlMessage ? (
				<HistoryErrorAlert title="History action failed" message={controlMessage} />
			) : null}
			{data ? (
				<>
					<HistoryFilterControl value={filter} onChange={onFilterChange} />
					<DocumentHistoryTable
						documents={visibleDocuments}
						pendingAction={pendingAction}
						isActionPending={isActionPending}
						onCreatorAction={onCreatorAction}
					/>
				</>
			) : null}
		</div>
	);
}

function HistoryErrorAlert({ title, message }: { title: string; message: string }) {
	return (
		<Alert variant="destructive" role="alert">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
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

function DocumentHistoryTable({
	documents,
	pendingAction,
	isActionPending,
	onCreatorAction,
}: {
	documents: DocumentHistoryItem[];
	pendingAction: PendingCreatorAction | null;
	isActionPending: boolean;
	onCreatorAction: (input: PendingCreatorAction) => void;
}) {
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
								<DocumentHistoryActions
									document={document}
									pendingAction={pendingAction}
									isActionPending={isActionPending}
									onCreatorAction={onCreatorAction}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DocumentHistoryActions({
	document,
	pendingAction,
	isActionPending,
	onCreatorAction,
}: {
	document: DocumentHistoryItem;
	pendingAction: PendingCreatorAction | null;
	isActionPending: boolean;
	onCreatorAction: (input: PendingCreatorAction) => void;
}) {
	const { action } = document;
	const hasActions = Boolean(action || document.creatorActions.length > 0);
	if (!hasActions) {
		return <span className="text-muted-foreground text-sm">No action available</span>;
	}
	return (
		<div className="flex flex-wrap gap-2">
			{action ? (
				<Button asChild size="sm">
					<a href={action.url}>
						{action.label}
						<ArrowRight className="size-4" />
					</a>
				</Button>
			) : null}
			{action?.type === "completed" && action.downloadUrl ? (
				<Button asChild size="sm" variant="outline">
					<a href={action.downloadUrl}>
						<Download className="size-4" />
						Download PDF
					</a>
				</Button>
			) : null}
			{document.creatorActions.map((creatorAction) => (
				<Button
					key={creatorAction.action}
					type="button"
					size="sm"
					variant="outline"
					aria-label={`${creatorAction.label} ${document.title}`}
					disabled={
						isActionPending &&
						pendingAction?.envelopeId === document.envelopeId &&
						pendingAction.action === creatorAction.action
					}
					onClick={() =>
						onCreatorAction({
							envelopeId: document.envelopeId,
							action: creatorAction.action,
						})
					}
				>
					{creatorAction.action === "cancel" ? (
						<Ban className="size-4" />
					) : (
						<Trash2 className="size-4" />
					)}
					{creatorAction.label}
				</Button>
			))}
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

async function runCreatorAction(
	input: PendingCreatorAction,
	senderSessionToken: string,
): Promise<void> {
	const response = await fetch(`/api/envelopes/${input.envelopeId}/actions`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-sender-session-token": senderSessionToken,
		},
		body: JSON.stringify({ action: input.action }),
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message = isHistoryError(json) ? json.error.message : "Unable to update this envelope";
		throw new Error(message);
	}
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
