import { z } from "zod";

export const HumanReviewNotificationStatusSchema = z.enum(["sent", "fallback", "failed"]);
export type HumanReviewNotificationStatus = z.infer<typeof HumanReviewNotificationStatusSchema>;

export const PendingHumanReviewCommandResponseSchema = z.object({
	data: z.object({
		commandId: z.string().uuid(),
		status: z.literal("pending_human_review"),
		reviewUrl: z.string().url(),
		statusUrl: z.string().url(),
		expiresAt: z.string().datetime(),
		notificationStatus: HumanReviewNotificationStatusSchema,
	}),
});
export type PendingHumanReviewCommandResponse = z.infer<
	typeof PendingHumanReviewCommandResponseSchema
>;

export const TerminalHumanReviewCommandResponseSchema = z.object({
	data: z.object({
		commandId: z.string().uuid(),
		status: z.enum(["completed", "rejected", "expired", "invalidated", "failed"]),
		notificationStatus: HumanReviewNotificationStatusSchema,
		result: z.unknown().optional(),
		error: z
			.object({
				code: z.enum([
					"HUMAN_REVIEW_REJECTED",
					"HUMAN_REVIEW_EXPIRED",
					"HUMAN_REVIEW_INVALIDATED",
					"HUMAN_REVIEW_EXECUTION_FAILED",
				]),
				message: z.string(),
				retryable: z.literal(false),
				recoveryUrl: z.string(),
			})
			.optional(),
	}),
});

export const HumanReviewCommandStatusResponseSchema = z.union([
	PendingHumanReviewCommandResponseSchema,
	TerminalHumanReviewCommandResponseSchema,
]);

export const agentHumanReviewOperations = {
	commandStatus: {
		method: "get",
		relativePath: "/commands/:commandId",
		publicPath: "/api/v1/commands/{commandId}",
		operationId: "getAgentCommandStatus",
	},
} as const;
