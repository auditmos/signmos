import { and, eq } from "drizzle-orm";
import {
	envelopeFields,
	envelopeRecipients,
	envelopes,
	sourceDocuments,
} from "@/db/envelope/table";
import { getDb } from "@/db/setup";
import type { AgenticPrincipal } from "./bearer-principal";
import { fingerprintAgentCommand } from "./command-authority";
import { agenticApiTokens, agenticCommandRecords } from "./table";

export type BeginHumanReviewApproval =
	| {
			state: "ready";
			commandId: string;
			documentId: string;
			operation: string;
			actionPayload: unknown;
			notificationStatus: "sent" | "fallback" | "failed";
			principal: AgenticPrincipal;
	  }
	| { state: "forbidden" | "expired" | "invalidated" | "already_decided" };

export async function beginHumanReviewApproval(input: {
	reviewId: string;
	session: { id: string; email: string };
	now: Date;
}): Promise<BeginHumanReviewApproval> {
	const commandRows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(eq(agenticCommandRecords.reviewId, input.reviewId))
		.limit(1);
	const command = commandRows.find((candidate) => candidate.reviewId === input.reviewId);
	if (
		!command ||
		!command.documentId ||
		!command.expiresAt ||
		!command.actionPayload ||
		!command.actionPayloadDigest ||
		!command.reviewerFieldsSnapshot ||
		!command.reviewerFieldsDigest ||
		!command.sourceDocumentId ||
		command.sourceVersion === null ||
		!command.sourceSha256 ||
		normalizeEmail(command.reviewerEmail ?? "") !== normalizeEmail(input.session.email)
	) {
		return { state: "forbidden" };
	}
	if (command.state !== "pending_human_review") return { state: "already_decided" };
	if (input.now.getTime() >= command.expiresAt.getTime()) {
		await markHumanReviewTerminal({
			command,
			status: "expired",
			now: input.now,
			reason: "HUMAN_REVIEW_EXPIRED",
		});
		return { state: "expired" };
	}
	const tokenRows = await getDb()
		.select()
		.from(agenticApiTokens)
		.where(and(eq(agenticApiTokens.id, command.tokenId), eq(agenticApiTokens.status, "active")))
		.limit(1);
	const token = tokenRows.find(
		(candidate) =>
			candidate.id === command.tokenId &&
			candidate.status === "active" &&
			normalizeEmail(candidate.email) === normalizeEmail(command.principalEmail ?? ""),
	);
	if (!token) {
		await markHumanReviewTerminal({
			command,
			status: "invalidated",
			now: input.now,
			reason: "TOKEN_REVOKED",
		});
		return { state: "invalidated" };
	}
	const sourceRows = await getDb()
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.envelopeId, command.documentId))
		.limit(100);
	const source = sourceRows
		.filter((candidate) => candidate.envelopeId === command.documentId)
		.sort((left, right) => right.version - left.version)[0];
	const payload = JSON.parse(command.actionPayload) as unknown;
	if (
		!source ||
		source.id !== command.sourceDocumentId ||
		source.version !== command.sourceVersion ||
		source.sha256 !== command.sourceSha256 ||
		(await fingerprintAgentCommand(payload)) !== command.actionPayloadDigest
	) {
		await markHumanReviewTerminal({
			command,
			status: "invalidated",
			now: input.now,
			reason: "BINDING_CHANGED",
		});
		return { state: "invalidated" };
	}
	if (!(await reviewerStillHasRole(command))) {
		await markHumanReviewTerminal({
			command,
			status: "invalidated",
			now: input.now,
			reason: "REVIEWER_ROLE_CHANGED",
		});
		return { state: "invalidated" };
	}
	if (!(await reviewerFieldsStillMatch(command))) {
		await markHumanReviewTerminal({
			command,
			status: "invalidated",
			now: input.now,
			reason: "ASSIGNED_FIELDS_CHANGED",
		});
		return { state: "invalidated" };
	}
	const claimed = await getDb()
		.update(agenticCommandRecords)
		.set({
			state: "executing",
			decisionAt: input.now,
			decidedByEmail: normalizeEmail(input.session.email),
			decidedBySessionId: input.session.id,
		})
		.where(
			and(
				eq(agenticCommandRecords.id, command.id),
				eq(agenticCommandRecords.state, "pending_human_review"),
			),
		)
		.returning();
	if (claimed.length === 0) return { state: "already_decided" };
	return {
		state: "ready",
		commandId: command.id,
		documentId: command.documentId,
		operation: command.operation,
		actionPayload: payload,
		notificationStatus: notificationStatus(command.notificationStatus),
		principal: {
			email: normalizeEmail(token.email),
			actorType: "agent",
			token: {
				id: token.id,
				name: token.name,
				hint: token.tokenHint,
				createdAt: token.createdAt,
				lastUsedAt: token.lastUsedAt ?? input.now,
			},
		},
	};
}

async function reviewerStillHasRole(
	command: typeof agenticCommandRecords.$inferSelect,
): Promise<boolean> {
	const email = normalizeEmail(command.reviewerEmail ?? "");
	if (command.reviewerRole === "signer" && command.reviewerRecipientId && command.documentId) {
		const rows = await getDb()
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.id, command.reviewerRecipientId))
			.limit(1);
		return rows.some(
			(recipient) =>
				recipient.id === command.reviewerRecipientId &&
				recipient.envelopeId === command.documentId &&
				normalizeEmail(recipient.email) === email,
		);
	}
	if (command.reviewerRole === "creator" && command.documentId) {
		const rows = await getDb()
			.select()
			.from(envelopes)
			.where(eq(envelopes.id, command.documentId))
			.limit(1);
		return rows.some(
			(envelope) =>
				envelope.id === command.documentId &&
				envelope.status !== "deleted" &&
				normalizeEmail(envelope.createdBy) === email,
		);
	}
	return false;
}

async function reviewerFieldsStillMatch(
	command: typeof agenticCommandRecords.$inferSelect,
): Promise<boolean> {
	if (!command.reviewerFieldsSnapshot || !command.reviewerFieldsDigest) return false;
	const stored = JSON.parse(command.reviewerFieldsSnapshot) as unknown;
	if ((await fingerprintAgentCommand(stored)) !== command.reviewerFieldsDigest) return false;
	if (command.reviewerRole !== "signer") return Array.isArray(stored) && stored.length === 0;
	if (!command.reviewerRecipientId || !command.documentId) return false;
	const rows = await getDb()
		.select()
		.from(envelopeFields)
		.where(eq(envelopeFields.recipientId, command.reviewerRecipientId))
		.limit(100);
	const current = rows
		.filter(
			(field) =>
				field.envelopeId === command.documentId &&
				field.recipientId === command.reviewerRecipientId,
		)
		.map(({ id, type, page, x, y, width, height }) => ({
			id,
			type,
			page,
			x,
			y,
			width,
			height,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
	return (await fingerprintAgentCommand(current)) === command.reviewerFieldsDigest;
}

export async function completeHumanReviewApproval(input: {
	commandId: string;
	notificationStatus: "sent" | "fallback" | "failed";
	result: unknown;
	now: Date;
}): Promise<unknown> {
	const body = {
		data: {
			commandId: input.commandId,
			status: "completed",
			notificationStatus: input.notificationStatus,
			result: input.result,
		},
	};
	await getDb()
		.update(agenticCommandRecords)
		.set({
			state: "completed",
			responseStatus: 200,
			responseBody: JSON.stringify(body),
			completedAt: input.now,
			terminalReason: null,
		})
		.where(eq(agenticCommandRecords.id, input.commandId));
	return body;
}

export async function invalidateHumanReviewApproval(input: {
	commandId: string;
	documentId: string;
	notificationStatus: "sent" | "fallback" | "failed";
	now: Date;
	reason: string;
}): Promise<void> {
	const body = {
		data: {
			commandId: input.commandId,
			status: "invalidated",
			notificationStatus: input.notificationStatus,
			error: {
				code: "HUMAN_REVIEW_INVALIDATED",
				message: "The human review request is no longer valid",
				retryable: false,
				recoveryUrl: `/api/v1/documents/${input.documentId}/status`,
			},
		},
	};
	await getDb()
		.update(agenticCommandRecords)
		.set({
			state: "invalidated",
			terminalReason: input.reason,
			responseStatus: 200,
			responseBody: JSON.stringify(body),
			completedAt: input.now,
		})
		.where(eq(agenticCommandRecords.id, input.commandId));
}

export async function failHumanReviewApproval(input: {
	commandId: string;
	documentId: string;
	notificationStatus: "sent" | "fallback" | "failed";
	now: Date;
}): Promise<unknown> {
	const body = {
		data: {
			commandId: input.commandId,
			status: "failed",
			notificationStatus: input.notificationStatus,
			error: {
				code: "HUMAN_REVIEW_EXECUTION_FAILED",
				message: "The approved action could not be executed",
				retryable: false,
				recoveryUrl: `/api/v1/documents/${input.documentId}/status`,
			},
		},
	};
	await getDb()
		.update(agenticCommandRecords)
		.set({
			state: "failed",
			terminalReason: "HUMAN_REVIEW_EXECUTION_FAILED",
			responseStatus: 200,
			responseBody: JSON.stringify(body),
			completedAt: input.now,
		})
		.where(
			and(
				eq(agenticCommandRecords.id, input.commandId),
				eq(agenticCommandRecords.state, "executing"),
			),
		);
	return body;
}

export type RejectHumanReviewResult =
	| { state: "rejected"; documentId: string; body: unknown }
	| { state: "forbidden" | "expired" | "already_decided" };

export async function rejectHumanReview(input: {
	reviewId: string;
	session: { id: string; email: string };
	now: Date;
}): Promise<RejectHumanReviewResult> {
	const rows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(eq(agenticCommandRecords.reviewId, input.reviewId))
		.limit(1);
	const command = rows.find((candidate) => candidate.reviewId === input.reviewId);
	if (
		!command ||
		!command.documentId ||
		!command.expiresAt ||
		normalizeEmail(command.reviewerEmail ?? "") !== normalizeEmail(input.session.email)
	) {
		return { state: "forbidden" };
	}
	if (command.state !== "pending_human_review") return { state: "already_decided" };
	if (input.now.getTime() >= command.expiresAt.getTime()) {
		await markHumanReviewTerminal({
			command,
			status: "expired",
			now: input.now,
			reason: "HUMAN_REVIEW_EXPIRED",
		});
		return { state: "expired" };
	}
	const body = {
		data: {
			commandId: command.id,
			status: "rejected",
			notificationStatus: notificationStatus(command.notificationStatus),
			error: {
				code: "HUMAN_REVIEW_REJECTED",
				message: "The human reviewer rejected this request",
				retryable: false,
				recoveryUrl: `/api/v1/documents/${command.documentId}/status`,
			},
		},
	};
	const updated = await getDb()
		.update(agenticCommandRecords)
		.set({
			state: "rejected",
			decisionAt: input.now,
			decidedByEmail: normalizeEmail(input.session.email),
			decidedBySessionId: input.session.id,
			terminalReason: "HUMAN_REVIEW_REJECTED",
			responseStatus: 200,
			responseBody: JSON.stringify(body),
			completedAt: input.now,
		})
		.where(
			and(
				eq(agenticCommandRecords.id, command.id),
				eq(agenticCommandRecords.state, "pending_human_review"),
			),
		)
		.returning();
	return updated.length > 0
		? { state: "rejected", documentId: command.documentId, body }
		: { state: "already_decided" };
}

async function markHumanReviewTerminal(input: {
	command: typeof agenticCommandRecords.$inferSelect;
	status: "expired" | "invalidated";
	now: Date;
	reason: string;
}): Promise<void> {
	const errorCode =
		input.status === "expired" ? "HUMAN_REVIEW_EXPIRED" : "HUMAN_REVIEW_INVALIDATED";
	const body = {
		data: {
			commandId: input.command.id,
			status: input.status,
			notificationStatus: notificationStatus(input.command.notificationStatus),
			error: {
				code: errorCode,
				message:
					input.status === "expired"
						? "The human review request expired"
						: "The human review request is no longer valid",
				retryable: false,
				recoveryUrl: `/api/v1/documents/${input.command.documentId}/status`,
			},
		},
	};
	await getDb()
		.update(agenticCommandRecords)
		.set({
			state: input.status,
			terminalReason: input.reason,
			responseStatus: 200,
			responseBody: JSON.stringify(body),
			completedAt: input.now,
		})
		.where(
			and(
				eq(agenticCommandRecords.id, input.command.id),
				eq(agenticCommandRecords.state, "pending_human_review"),
			),
		);
}

function notificationStatus(value: string | null): "sent" | "fallback" | "failed" {
	return value === "sent" || value === "failed" ? value : "fallback";
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
