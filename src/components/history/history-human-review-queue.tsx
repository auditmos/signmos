import { useQuery } from "@tanstack/react-query";

interface HumanReviewQueueItem {
	commandId: string;
	documentId: string;
	title: string;
	actionLabel: string;
	agentName: string;
	status: "pending_human_review";
	expiresAt: string;
	reviewUrl: string;
}

interface HumanReviewQueueResponse {
	data: { items: HumanReviewQueueItem[] };
}

export function HistoryHumanReviewQueue() {
	const queue = useQuery({
		queryKey: ["history-human-reviews"],
		queryFn: fetchHumanReviewQueue,
	});
	if (!queue.data || queue.data.length === 0) return null;
	return (
		<section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
			<h2 className="text-xl font-semibold text-foreground">Pending human reviews</h2>
			<p className="text-sm text-muted-foreground">
				These agent-requested actions will not run until you explicitly approve them.
			</p>
			<ul className="space-y-3">
				{queue.data.map((item) => (
					<li key={item.commandId} className="rounded-md border bg-card p-4">
						<p className="font-medium text-foreground">{item.title}</p>
						<p className="text-sm text-muted-foreground">
							{item.actionLabel} requested by {item.agentName}. Expires {formatDate(item.expiresAt)}
							.
						</p>
						<a
							className="mt-2 inline-flex rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={item.reviewUrl}
						>
							Review requested action
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

async function fetchHumanReviewQueue(): Promise<HumanReviewQueueItem[]> {
	const response = await fetch("/api/history/human-reviews", { credentials: "same-origin" });
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok || !isQueueResponse(body)) throw new Error("Unable to load human reviews");
	return body.data.items;
}

function isQueueResponse(value: unknown): value is HumanReviewQueueResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
		return false;
	}
	return data.items.every(
		(item) =>
			item &&
			typeof item === "object" &&
			"status" in item &&
			item.status === "pending_human_review" &&
			"reviewUrl" in item &&
			typeof item.reviewUrl === "string" &&
			"expiresAt" in item &&
			typeof item.expiresAt === "string" &&
			!Number.isNaN(new Date(item.expiresAt).getTime()),
	);
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(value),
	);
}
