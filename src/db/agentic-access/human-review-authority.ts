import { and, eq } from "drizzle-orm";
import { isUniqueViolation } from "@/core/errors";
import { sourceDocuments } from "@/db/envelope/table";
import { getDb } from "@/db/setup";
import type { AgenticPrincipal } from "./bearer-principal";
import { type AgentCommandClaim, fingerprintAgentCommand } from "./command-authority";
import {
	type PendingHumanReviewCommandResponse,
	PendingHumanReviewCommandResponseSchema,
} from "./human-review-schema";
import { agenticCommandRecords } from "./table";

const HUMAN_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export type HumanReviewCommandClaim =
	| {
			state: "created";
			commandId: string;
			reviewId: string;
			response: PendingHumanReviewCommandResponse;
	  }
	| Exclude<AgentCommandClaim, { state: "execute" }>;

export interface HumanReviewFieldSnapshot {
	id: string;
	type: string;
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export async function claimHumanReviewCommand(input: {
	principal: AgenticPrincipal;
	idempotencyKey: string;
	operation: string;
	requestFingerprint: string;
	documentId: string;
	reviewer: {
		email: string;
		role: "signer" | "creator";
		recipientId?: string | null;
		fields: HumanReviewFieldSnapshot[];
	};
	source: { id: string; version: number; sha256: string; originalFilename: string };
	actionPayload: unknown;
	actionPayloadDigest: string;
	baseUrl: string;
	now: Date;
}): Promise<HumanReviewCommandClaim> {
	const existing = await findHumanReviewCommand(input.principal.token.id, input.idempotencyKey);
	if (existing) return existingHumanReviewClaim(existing, input);

	const commandId = crypto.randomUUID();
	const reviewId = crypto.randomUUID();
	const expiresAt = new Date(input.now.getTime() + HUMAN_REVIEW_TTL_MS);
	const reviewerFields = normalizeFieldSnapshots(input.reviewer.fields);
	const response = pendingResponse({
		baseUrl: input.baseUrl,
		commandId,
		reviewId,
		expiresAt,
		notificationStatus: "fallback",
	});
	try {
		const [record] = await getDb()
			.insert(agenticCommandRecords)
			.values({
				id: commandId,
				tokenId: input.principal.token.id,
				idempotencyKey: input.idempotencyKey,
				operation: input.operation,
				requestFingerprint: input.requestFingerprint,
				state: "pending_human_review",
				reviewId,
				principalEmail: normalizeEmail(input.principal.email),
				tokenName: input.principal.token.name,
				reviewerEmail: normalizeEmail(input.reviewer.email),
				reviewerRole: input.reviewer.role,
				reviewerRecipientId: input.reviewer.recipientId ?? null,
				reviewerFieldsSnapshot: stableJson(reviewerFields),
				reviewerFieldsDigest: await fingerprintAgentCommand(reviewerFields),
				documentTitle: input.source.originalFilename,
				documentId: input.documentId,
				sourceDocumentId: input.source.id,
				sourceVersion: input.source.version,
				sourceSha256: input.source.sha256,
				actionPayload: stableJson(input.actionPayload),
				actionPayloadDigest: input.actionPayloadDigest,
				expiresAt,
				decisionAt: null,
				terminalReason: null,
				notificationStatus: "fallback",
				notificationProviderMessage: "Review link available through authenticated Signmos",
				decidedByEmail: null,
				decidedBySessionId: null,
				responseStatus: 202,
				responseBody: JSON.stringify(response),
				completedAt: null,
				createdAt: input.now,
			})
			.returning();
		if (!record) throw new Error("Failed to create human-review command");
		return { state: "created", commandId, reviewId, response };
	} catch (error) {
		if (!isUniqueViolation(error)) throw error;
		const concurrent = await findHumanReviewCommand(input.principal.token.id, input.idempotencyKey);
		if (!concurrent) throw error;
		return existingHumanReviewClaim(concurrent, input);
	}
}

export async function inspectHumanReviewCommand(input: {
	principal: AgenticPrincipal;
	idempotencyKey: string;
	operation: string;
	requestFingerprint: string;
}): Promise<Exclude<AgentCommandClaim, { state: "execute" }> | null> {
	const existing = await findHumanReviewCommand(input.principal.token.id, input.idempotencyKey);
	return existing ? existingHumanReviewClaim(existing, input) : null;
}

export async function getHumanReviewCommandStatus(
	principal: AgenticPrincipal,
	commandId: string,
	now = new Date(),
): Promise<unknown | null> {
	const rows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(
			and(
				eq(agenticCommandRecords.id, commandId),
				eq(agenticCommandRecords.tokenId, principal.token.id),
			),
		)
		.limit(1);
	const row = rows.find(
		(candidate) => candidate.id === commandId && candidate.tokenId === principal.token.id,
	);
	if (
		row?.state === "pending_human_review" &&
		row.expiresAt &&
		now.getTime() >= row.expiresAt.getTime()
	) {
		const body = expiredCommandResponse(row);
		const updated = await getDb()
			.update(agenticCommandRecords)
			.set({
				state: "expired",
				terminalReason: "HUMAN_REVIEW_EXPIRED",
				responseStatus: 200,
				responseBody: JSON.stringify(body),
				completedAt: now,
			})
			.where(
				and(
					eq(agenticCommandRecords.id, commandId),
					eq(agenticCommandRecords.state, "pending_human_review"),
				),
			)
			.returning();
		if (updated.length > 0) return body;
		const concurrent = await getDb()
			.select()
			.from(agenticCommandRecords)
			.where(eq(agenticCommandRecords.id, commandId))
			.limit(1);
		const current = concurrent.find(
			(candidate) => candidate.id === commandId && candidate.tokenId === principal.token.id,
		);
		return current?.responseBody ? (JSON.parse(current.responseBody) as unknown) : null;
	}
	return row?.responseBody ? (JSON.parse(row.responseBody) as unknown) : null;
}

function expiredCommandResponse(command: typeof agenticCommandRecords.$inferSelect) {
	return {
		data: {
			commandId: command.id,
			status: "expired",
			notificationStatus:
				command.notificationStatus === "sent" || command.notificationStatus === "failed"
					? command.notificationStatus
					: "fallback",
			error: {
				code: "HUMAN_REVIEW_EXPIRED",
				message: "The human review request expired",
				retryable: false,
				recoveryUrl: `/api/v1/documents/${command.documentId}/status`,
			},
		},
	};
}

export async function recordHumanReviewNotification(input: {
	commandId: string;
	response: PendingHumanReviewCommandResponse;
	status: "sent" | "failed";
	providerMessage: string | null;
}): Promise<PendingHumanReviewCommandResponse> {
	const response = PendingHumanReviewCommandResponseSchema.parse({
		data: { ...input.response.data, notificationStatus: input.status },
	});
	await getDb()
		.update(agenticCommandRecords)
		.set({
			notificationStatus: input.status,
			notificationProviderMessage: input.providerMessage,
			responseBody: JSON.stringify(response),
		})
		.where(eq(agenticCommandRecords.id, input.commandId));
	return response;
}

export interface HumanReviewDetail {
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

export async function getHumanReviewDetail(input: {
	session: { id: string; email: string };
	reviewId: string;
}): Promise<HumanReviewDetail | null> {
	const commandRows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(eq(agenticCommandRecords.reviewId, input.reviewId))
		.limit(1);
	const command = commandRows.find((candidate) => candidate.reviewId === input.reviewId);
	if (
		!command ||
		!command.reviewId ||
		!command.documentId ||
		!command.expiresAt ||
		!command.tokenName ||
		!command.actionPayload ||
		!command.reviewerFieldsSnapshot ||
		!command.sourceDocumentId ||
		!command.documentTitle ||
		normalizeEmail(command.reviewerEmail ?? "") !== normalizeEmail(input.session.email)
	) {
		return null;
	}
	const sources = await getDb()
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.id, command.sourceDocumentId))
		.limit(1);
	const source = sources.find(
		(candidate) =>
			candidate.id === command.sourceDocumentId &&
			candidate.envelopeId === command.documentId &&
			candidate.version === command.sourceVersion &&
			candidate.sha256 === command.sourceSha256,
	);
	if (!source && (command.state === "pending_human_review" || command.state === "executing")) {
		return null;
	}
	if (command.sourceVersion === null || !command.sourceSha256) return null;
	const sourceAvailable = source && !isCompletedDeleteReview(command);
	const fields = JSON.parse(command.reviewerFieldsSnapshot) as HumanReviewFieldSnapshot[];
	return {
		commandId: command.id,
		reviewId: command.reviewId,
		status: command.state,
		expiresAt: command.expiresAt.toISOString(),
		document: {
			documentId: command.documentId,
			title: source?.originalFilename ?? command.documentTitle,
			sourceVersion: source?.version ?? command.sourceVersion,
			sourceSha256: source?.sha256 ?? command.sourceSha256,
			sourcePdfUrl: sourceAvailable
				? `/api/history/human-reviews/${command.reviewId}/source-pdf`
				: null,
			assignedFields: fields,
		},
		action: reviewAction(command.operation, command.actionPayload),
		agent: { name: command.tokenName },
	};
}

export async function getHumanReviewSourceAccess(input: {
	session: { id: string; email: string };
	reviewId: string;
}): Promise<{
	documentId: string;
	r2Key: string;
	contentType: string;
} | null> {
	const commandRows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(eq(agenticCommandRecords.reviewId, input.reviewId))
		.limit(1);
	const command = commandRows.find((candidate) => candidate.reviewId === input.reviewId);
	if (
		!command?.documentId ||
		!command.sourceDocumentId ||
		isCompletedDeleteReview(command) ||
		normalizeEmail(command.reviewerEmail ?? "") !== normalizeEmail(input.session.email)
	) {
		return null;
	}
	const sources = await getDb()
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.id, command.sourceDocumentId))
		.limit(1);
	const source = sources.find(
		(candidate) =>
			candidate.id === command.sourceDocumentId && candidate.envelopeId === command.documentId,
	);
	return source
		? { documentId: command.documentId, r2Key: source.r2Key, contentType: source.contentType }
		: null;
}

function isCompletedDeleteReview(command: typeof agenticCommandRecords.$inferSelect): boolean {
	if (command.state !== "completed" || command.operation !== "controlAgentDocument") return false;
	if (!command.actionPayload) return false;
	try {
		const payload = JSON.parse(command.actionPayload) as unknown;
		return Boolean(
			payload && typeof payload === "object" && "action" in payload && payload.action === "delete",
		);
	} catch {
		return false;
	}
}

interface StoredHumanReviewCommand {
	operation: string;
	requestFingerprint: string;
	state: string;
	responseStatus: number | null;
	responseBody: string | null;
}

async function findHumanReviewCommand(
	tokenId: string,
	idempotencyKey: string,
): Promise<StoredHumanReviewCommand | null> {
	const rows = await getDb()
		.select()
		.from(agenticCommandRecords)
		.where(
			and(
				eq(agenticCommandRecords.tokenId, tokenId),
				eq(agenticCommandRecords.idempotencyKey, idempotencyKey),
			),
		)
		.limit(1);
	const row = rows.find(
		(candidate) => candidate.tokenId === tokenId && candidate.idempotencyKey === idempotencyKey,
	);
	return row
		? {
				operation: row.operation,
				requestFingerprint: row.requestFingerprint,
				state: row.state,
				responseStatus: row.responseStatus,
				responseBody: row.responseBody,
			}
		: null;
}

function existingHumanReviewClaim(
	record: StoredHumanReviewCommand,
	input: { operation: string; requestFingerprint: string },
): Exclude<AgentCommandClaim, { state: "execute" }> {
	if (
		record.operation !== input.operation ||
		record.requestFingerprint !== input.requestFingerprint
	) {
		return { state: "conflict" };
	}
	if (typeof record.responseStatus === "number" && record.responseBody !== null) {
		return {
			state: "replay",
			status: record.responseStatus,
			body: JSON.parse(record.responseBody) as unknown,
		};
	}
	return { state: "in_progress" };
}

function pendingResponse(input: {
	baseUrl: string;
	commandId: string;
	reviewId: string;
	expiresAt: Date;
	notificationStatus: "fallback";
}): PendingHumanReviewCommandResponse {
	const baseUrl = input.baseUrl.replace(/\/+$/, "");
	return PendingHumanReviewCommandResponseSchema.parse({
		data: {
			commandId: input.commandId,
			status: "pending_human_review",
			reviewUrl: `${baseUrl}/human-review/${input.reviewId}`,
			statusUrl: `${baseUrl}/api/v1/commands/${input.commandId}`,
			expiresAt: input.expiresAt.toISOString(),
			notificationStatus: input.notificationStatus,
		},
	});
}

function stableJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(",")}}`;
}

function normalizeFieldSnapshots(fields: HumanReviewFieldSnapshot[]): HumanReviewFieldSnapshot[] {
	return fields
		.map((field) => ({ ...field }))
		.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function reviewAction(operation: string, payload: string): HumanReviewDetail["action"] {
	if (operation === "completeAgentSigning") {
		return {
			kind: "complete",
			label: "Sign and complete",
			payload,
			consequence: "This will sign the current document and may complete it.",
		};
	}
	if (operation === "declineAgentSigning") {
		return {
			kind: "decline",
			label: "Decline signing",
			payload,
			consequence: "This will decline the document and stop signing.",
		};
	}
	const parsed = JSON.parse(payload) as { action?: string };
	const kind =
		parsed.action === "cancel" || parsed.action === "expire" || parsed.action === "delete"
			? parsed.action
			: "delete";
	return {
		kind,
		label: `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)} document`,
		payload,
		consequence: `This will ${kind} the current document.`,
	};
}
