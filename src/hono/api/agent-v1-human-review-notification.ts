import {
	type AgenticPrincipal,
	type PendingHumanReviewCommandResponse,
	recordAgentDocumentRead,
	recordHumanReviewNotification,
} from "@/db/agentic-access";
import {
	buildHumanReviewEmail,
	deliverTransactionalEmail,
	EmailDeliveryError,
	type EmailDeliveryOptions,
	isResendConfigured,
} from "@/db/envelope";

export type HumanReviewIntentAuditEvent =
	| "agentic.human_review.signing_requested"
	| "agentic.human_review.decline_requested"
	| "agentic.human_review.cancel_requested"
	| "agentic.human_review.expire_requested"
	| "agentic.human_review.delete_requested";

export async function deliverHumanReviewNotification(input: {
	principal: AgenticPrincipal;
	documentId: string;
	intentAuditEvent: HumanReviewIntentAuditEvent;
	commandId: string;
	response: PendingHumanReviewCommandResponse;
	reviewerEmail: string;
	documentName: string;
	actionLabel: string;
	agentName: string;
	consequence: string;
	emailDelivery: EmailDeliveryOptions;
}): Promise<PendingHumanReviewCommandResponse> {
	await recordReviewAudit(input, input.intentAuditEvent);
	if (!isResendConfigured(input.emailDelivery.env)) {
		await recordReviewAudit(input, "agentic.human_review.notification.fallback");
		return input.response;
	}
	try {
		const delivery = await deliverTransactionalEmail(
			buildHumanReviewEmail({
				email: input.reviewerEmail,
				documentName: input.documentName,
				actionLabel: input.actionLabel,
				agentName: input.agentName,
				consequence: input.consequence,
				expiresAt: input.response.data.expiresAt,
				reviewUrl: input.response.data.reviewUrl,
			}),
			input.emailDelivery,
		);
		const response = await recordHumanReviewNotification({
			commandId: input.commandId,
			response: input.response,
			status: "sent",
			providerMessage: delivery.providerMessage,
		});
		await recordReviewAudit(input, "agentic.human_review.notification.sent");
		return response;
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
		const response = await recordHumanReviewNotification({
			commandId: input.commandId,
			response: input.response,
			status: "failed",
			providerMessage: `${error.status}: ${error.responseText.slice(0, 500)}`,
		});
		await recordReviewAudit(input, "agentic.human_review.notification.failed");
		return response;
	}
}

function recordReviewAudit(
	input: Pick<Parameters<typeof deliverHumanReviewNotification>[0], "principal" | "documentId">,
	eventType: Parameters<typeof recordAgentDocumentRead>[0]["eventType"],
) {
	return recordAgentDocumentRead({
		principal: input.principal,
		documentId: input.documentId,
		eventType,
	});
}
