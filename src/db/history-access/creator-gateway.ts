import { eq } from "drizzle-orm";
import {
	auditEvents,
	EnvelopeSchema,
	type EnvelopeStatus,
	envelopes,
	SenderVerificationTokenSchema,
	type SigningMode,
	senderVerificationTokens,
} from "@/db/envelope";
import { getDb } from "@/db/setup";
import { normalizeHistoryEmail } from "./request";
import { recordHistoryEnvelopeSecurityEvent } from "./security-audit";

export type HistoryCreatorAction =
	| "resume"
	| "review"
	| "view_completed"
	| "download_final_pdf"
	| "cancel"
	| "delete";

export interface HistoryCreatorAccess {
	envelopeId: string;
	status: Exclude<EnvelopeStatus, "deleted">;
	signingMode: SigningMode;
	sender: { name: string; email: string };
	allowedActions: HistoryCreatorAction[];
	resumeUrl: string;
}

export type HistoryCreatorAuthorization =
	| { state: "active"; access: HistoryCreatorAccess }
	| { state: "deleted" }
	| { state: "forbidden" };

export async function authorizeHistoryCreator(
	email: string,
	envelopeId: string,
	now = new Date(),
): Promise<HistoryCreatorAuthorization> {
	const db = getDb();
	const [envelopeRows, tokenRows] = await Promise.all([
		db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1),
		db
			.select()
			.from(senderVerificationTokens)
			.where(eq(senderVerificationTokens.envelopeId, envelopeId))
			.limit(20),
	]);
	const envelopeRow = envelopeRows.find((candidate) => candidate.id === envelopeId);
	if (!envelopeRow) return { state: "forbidden" };
	const envelope = EnvelopeSchema.parse(envelopeRow);
	const normalizedEmail = normalizeHistoryEmail(email);
	if (normalizeHistoryEmail(envelope.createdBy) !== normalizedEmail) {
		return { state: "forbidden" };
	}
	if (envelope.status === "deleted") return { state: "deleted" };
	const matchingTokens = tokenRows
		.filter(
			(candidate) =>
				candidate.envelopeId === envelopeId &&
				normalizeHistoryEmail(candidate.email) === normalizedEmail,
		)
		.map((candidate) => SenderVerificationTokenSchema.parse(candidate))
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
	const token = matchingTokens[0] ?? null;
	let status = envelope.status;
	if (status === "awaiting_verification") {
		if (!token) return { state: "forbidden" };
		if (token.status !== "verified") {
			await db
				.update(senderVerificationTokens)
				.set({ status: "verified", verifiedAt: now })
				.where(eq(senderVerificationTokens.id, token.id));
			await db.update(envelopes).set({ status: "draft" }).where(eq(envelopes.id, envelopeId));
			await db
				.insert(auditEvents)
				.values({
					envelopeId,
					recipientId: null,
					eventType: "sender.verified",
					message: normalizedEmail,
				})
				.returning();
		}
		status = "draft";
	}
	return {
		state: "active",
		access: {
			envelopeId,
			status,
			signingMode: envelope.signingMode,
			sender: {
				name: envelope.createdByName ?? token?.name ?? normalizedEmail,
				email: normalizedEmail,
			},
			allowedActions: creatorActions(status),
			resumeUrl: `/my-documents/${envelopeId}/manage`,
		},
	};
}

export async function recordHistoryCreatorAudit(input: {
	session: { id: string; email: string };
	envelopeId: string;
	eventType: "history.creator.opened" | "history.creator.canceled" | "history.creator.deleted";
	requestIp?: string | null;
}): Promise<void> {
	await recordHistoryEnvelopeSecurityEvent(input);
}

function creatorActions(status: Exclude<EnvelopeStatus, "deleted">): HistoryCreatorAction[] {
	if (status === "awaiting_verification" || status === "draft") return ["resume"];
	if (status === "changes_requested") return ["resume", "cancel", "delete"];
	if (status === "sent") return ["review", "cancel", "delete"];
	if (status === "completed") return ["view_completed", "download_final_pdf", "delete"];
	if (status === "expired") return ["delete"];
	return [];
}
