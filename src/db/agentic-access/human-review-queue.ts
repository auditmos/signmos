import { sourceDocuments } from "@/db/envelope/table";
import { getDb } from "@/db/setup";
import { agenticCommandRecords } from "./table";

export interface HumanReviewQueueItem {
	commandId: string;
	documentId: string;
	title: string;
	actionLabel: string;
	agentName: string;
	status: "pending_human_review";
	expiresAt: string;
	reviewUrl: string;
}

export async function listPendingHumanReviews(
	session: { id: string; email: string },
	now: Date,
): Promise<HumanReviewQueueItem[]> {
	const [commands, sources] = await Promise.all([
		getDb().select().from(agenticCommandRecords),
		getDb().select().from(sourceDocuments),
	]);
	const email = normalizeEmail(session.email);
	return commands
		.filter(
			(command) =>
				command.state === "pending_human_review" &&
				normalizeEmail(command.reviewerEmail ?? "") === email &&
				Boolean(command.reviewId && command.documentId && command.tokenName && command.expiresAt) &&
				(command.expiresAt?.getTime() ?? 0) > now.getTime(),
		)
		.flatMap((command) => {
			const source = sources.find((candidate) => candidate.id === command.sourceDocumentId);
			if (
				!source ||
				!command.reviewId ||
				!command.documentId ||
				!command.tokenName ||
				!command.expiresAt
			) {
				return [];
			}
			return [
				{
					commandId: command.id,
					documentId: command.documentId,
					title: source.originalFilename,
					actionLabel: actionLabel(command.operation, command.actionPayload),
					agentName: command.tokenName,
					status: "pending_human_review" as const,
					expiresAt: command.expiresAt.toISOString(),
					reviewUrl: `/human-review/${command.reviewId}`,
				},
			];
		})
		.sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));
}

function actionLabel(operation: string, actionPayload: string | null): string {
	if (operation === "completeAgentSigning") return "Sign and complete";
	if (operation === "declineAgentSigning") return "Decline signing";
	const payload = actionPayload ? (JSON.parse(actionPayload) as { action?: string }) : {};
	if (payload.action === "cancel") return "Cancel document";
	if (payload.action === "expire") return "Expire document";
	return "Delete document";
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
