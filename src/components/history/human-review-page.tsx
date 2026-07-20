import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface HumanReviewDetail {
	commandId: string;
	reviewId: string;
	status: string;
	expiresAt: string;
	document: {
		documentId: string;
		title: string;
		sourceVersion: number;
		sourceSha256: string;
		sourcePdfUrl: string | null;
		assignedFields: Array<{
			id: string;
			type: string;
			page: number;
			x: number;
			y: number;
			width: number;
			height: number;
		}>;
	};
	action: {
		kind: "complete" | "decline" | "cancel" | "expire" | "delete";
		label: string;
		payload: string;
		consequence: string;
	};
	agent: { name: string };
}

interface HumanReviewPageProps {
	reviewId: string;
	onNotNow?: () => void;
	onVerificationRequired?: (url: string) => void;
}

const defaultOnNotNow = () => window.location.assign("/my-documents");
const defaultOnVerificationRequired = (url: string) => window.location.assign(url);

export function HumanReviewPage({
	reviewId,
	onNotNow = defaultOnNotNow,
	onVerificationRequired = defaultOnVerificationRequired,
}: HumanReviewPageProps) {
	const terminalStatusRef = useRef<HTMLOutputElement>(null);
	const detailQuery = useQuery({
		queryKey: ["human-review", reviewId],
		queryFn: () => fetchHumanReview(reviewId),
	});
	const decision = useMutation({
		mutationFn: (value: "approve" | "reject") => decideHumanReview(reviewId, value),
	});

	useEffect(() => {
		if (decision.isSuccess) terminalStatusRef.current?.focus();
	}, [decision.isSuccess]);
	useEffect(() => {
		if (detailQuery.error instanceof HumanReviewAuthenticationError) {
			onVerificationRequired(detailQuery.error.recoveryUrl);
		}
	}, [detailQuery.error, onVerificationRequired]);

	const detail = detailQuery.data;
	const pending = detail?.status === "pending_human_review" && !decision.isSuccess;
	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-3xl space-y-6">
				<p className="text-sm font-medium text-primary">Signmos human review</p>
				<h1 className="text-3xl font-semibold text-foreground">Review requested action</h1>
				{detailQuery.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Loading review…
					</output>
				) : null}
				{detailQuery.isError || decision.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Unable to continue this review</AlertTitle>
						<AlertDescription>
							The request may be unavailable, expired, changed, or already decided.
						</AlertDescription>
					</Alert>
				) : null}
				{detail ? <ReviewDetails detail={detail} /> : null}
				{detail && detail.status !== "pending_human_review" ? (
					<output
						aria-live="polite"
						className="block rounded-lg border bg-card p-4 text-foreground"
					>
						{terminalStatusMessage(detail.status)}
					</output>
				) : null}
				{pending ? (
					<fieldset className="flex flex-wrap gap-3">
						<legend className="sr-only">Human review decision</legend>
						<Button
							type="button"
							onClick={() => decision.mutate("approve")}
							disabled={decision.isPending}
						>
							{decision.isPending ? "Executing…" : "Approve and execute"}
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={() => decision.mutate("reject")}
							disabled={decision.isPending}
						>
							Reject request
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={onNotNow}
							disabled={decision.isPending}
						>
							Not now
						</Button>
					</fieldset>
				) : null}
				{decision.isSuccess ? (
					<output
						ref={terminalStatusRef}
						tabIndex={-1}
						aria-live="polite"
						className="block rounded-lg border bg-card p-4 text-foreground"
					>
						{terminalStatusMessage(decision.data.status)}
					</output>
				) : null}
			</section>
		</main>
	);
}

function ReviewDetails({ detail }: { detail: HumanReviewDetail }) {
	return (
		<div className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
			<div>
				<h2 className="text-xl font-semibold text-foreground">{detail.document.title}</h2>
				<p className="text-sm text-muted-foreground">
					Current revision {detail.document.sourceVersion} · Expires {formatDate(detail.expiresAt)}
				</p>
			</div>
			{detail.document.sourcePdfUrl ? (
				<a
					className="inline-flex rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					href={detail.document.sourcePdfUrl}
					target="_blank"
					rel="noreferrer"
				>
					Open current PDF
				</a>
			) : (
				<p className="text-sm text-muted-foreground">
					The reviewed source PDF is no longer retained.
				</p>
			)}
			<div>
				<p className="font-medium text-foreground">Requested by</p>
				<p className="text-muted-foreground">{detail.agent.name}</p>
			</div>
			<div>
				<p className="font-medium text-foreground">{detail.action.label}</p>
				<p className="text-destructive">{detail.action.consequence}</p>
			</div>
			<div>
				<p className="font-medium text-foreground">Exact proposed payload</p>
				<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground">
					{detail.action.payload}
				</pre>
			</div>
			{detail.document.assignedFields.length > 0 ? (
				<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
					{detail.document.assignedFields.map((field) => (
						<li key={field.id}>
							{field.type} field on page {field.page} at ({field.x}, {field.y}), {field.width} ×{" "}
							{field.height}
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

async function fetchHumanReview(reviewId: string): Promise<HumanReviewDetail> {
	const response = await fetch(`/api/history/human-reviews/${encodeURIComponent(reviewId)}`, {
		credentials: "same-origin",
	});
	const body: unknown = await response.json().catch(() => null);
	if (response.status === 401 && isRecoveryResponse(body)) {
		throw new HumanReviewAuthenticationError(body.error.recoveryUrl);
	}
	if (!response.ok || !isDetailResponse(body)) throw new Error("Unable to load human review");
	return body.data;
}

async function decideHumanReview(
	reviewId: string,
	decision: "approve" | "reject",
): Promise<{ status: string }> {
	const response = await fetch(
		`/api/history/human-reviews/${encodeURIComponent(reviewId)}/decision`,
		{
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ decision }),
		},
	);
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok || !isDecisionResponse(body)) throw new Error("Unable to decide human review");
	return { status: body.data.status };
}

function isDetailResponse(value: unknown): value is { data: HumanReviewDetail } {
	return Boolean(value && typeof value === "object" && "data" in value);
}

function isDecisionResponse(value: unknown): value is { data: { status: string } } {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "status" in data);
}

function isRecoveryResponse(value: unknown): value is { error: { recoveryUrl: string } } {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "recoveryUrl" in error);
}

class HumanReviewAuthenticationError extends Error {
	constructor(readonly recoveryUrl: string) {
		super("Reviewer email verification is required");
		this.name = "HumanReviewAuthenticationError";
	}
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(value),
	);
}

function terminalStatusMessage(status: string): string {
	if (status === "completed") return "Approved and executed.";
	if (status === "rejected") return "Request rejected. No document action was executed.";
	if (status === "expired") return "This review request expired without execution.";
	if (status === "invalidated") return "This review request was invalidated without execution.";
	if (status === "failed") return "Approval was recorded, but the requested action failed.";
	if (status === "executing") return "Approval was recorded and the requested action is executing.";
	return "This review request is no longer pending.";
}
