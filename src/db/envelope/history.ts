import { gte, inArray } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	type Envelope,
	EnvelopeSchema,
	type EnvelopeStatus,
	type FinalDocument,
	FinalDocumentSchema,
	type Recipient,
	RecipientSchema,
	type SignerToken,
	SignerTokenSchema,
} from "./schema";
import { envelopeRecipients, envelopes, finalDocuments, signerTokens } from "./table";

export type DocumentHistoryState = "draft" | "in_progress" | "completed";
export type DocumentHistoryDocumentType = "self_signed" | "signed_with_partner";
export type DocumentHistoryRole = "creator" | "signer" | "creator_and_signer";

export interface DocumentHistoryAction {
	type: "resume" | "completed";
	label: string;
	url: string;
	downloadUrl?: string;
}

export interface DocumentHistoryCreatorAction {
	action: "cancel" | "delete";
	label: string;
}

export interface DocumentHistoryItem {
	envelopeId: string;
	title: string;
	status: EnvelopeStatus;
	state: DocumentHistoryState;
	documentType: DocumentHistoryDocumentType;
	role: DocumentHistoryRole;
	createdAt: string;
	action: DocumentHistoryAction | null;
	creatorActions: DocumentHistoryCreatorAction[];
}

export interface DocumentHistoryResult {
	email: string;
	windowDays: number;
	windowStart: string;
	documents: DocumentHistoryItem[];
}

interface DocumentHistoryInput {
	email: string;
	senderSessionToken: string;
	now?: Date;
}

interface HistoryContext {
	envelope: Envelope;
	email: string;
	now: Date;
	senderSessionToken: string;
	recipients: Recipient[];
	signerTokens: SignerToken[];
	finalDocument: FinalDocument | null;
}

const historyWindowDays = 30;
const dayMs = 24 * 60 * 60 * 1000;

export async function getDocumentHistoryForEmail(
	input: DocumentHistoryInput,
): Promise<DocumentHistoryResult> {
	const now = input.now ?? new Date();
	const email = normalizeEmail(input.email);
	const windowStart = new Date(now.getTime() - historyWindowDays * dayMs);
	const db = getDb();
	const candidateEnvelopes = (
		await db.select().from(envelopes).where(gte(envelopes.createdAt, windowStart)).limit(500)
	)
		.map((row) => EnvelopeSchema.parse(row))
		.filter((envelope) => envelope.createdAt >= windowStart);
	const envelopeIds = candidateEnvelopes.map((envelope) => envelope.id);
	const recipients = envelopeIds.length
		? (
				await db
					.select()
					.from(envelopeRecipients)
					.where(inArray(envelopeRecipients.envelopeId, envelopeIds))
					.limit(2000)
			).map((row) => RecipientSchema.parse(row))
		: [];
	const tokens = envelopeIds.length
		? (
				await db
					.select()
					.from(signerTokens)
					.where(inArray(signerTokens.envelopeId, envelopeIds))
					.limit(2000)
			).map((row) => SignerTokenSchema.parse(row))
		: [];
	const documents = envelopeIds.length
		? (
				await db
					.select()
					.from(finalDocuments)
					.where(inArray(finalDocuments.envelopeId, envelopeIds))
					.limit(500)
			).map((row) => FinalDocumentSchema.parse(row))
		: [];

	return {
		email,
		windowDays: historyWindowDays,
		windowStart: windowStart.toISOString(),
		documents: candidateEnvelopes
			.filter((envelope) => envelope.status !== "deleted")
			.map((envelope) =>
				toHistoryItem({
					envelope,
					email,
					now,
					senderSessionToken: input.senderSessionToken,
					recipients: recipients.filter((recipient) => recipient.envelopeId === envelope.id),
					signerTokens: tokens.filter((token) => token.envelopeId === envelope.id),
					finalDocument: documents.find((document) => document.envelopeId === envelope.id) ?? null,
				}),
			)
			.filter((item): item is DocumentHistoryItem => Boolean(item))
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
	};
}

function toHistoryItem(context: HistoryContext): DocumentHistoryItem | null {
	const signerRecipients = context.recipients.filter(
		(recipient) => normalizeEmail(recipient.email) === context.email,
	);
	const isCreator = normalizeEmail(context.envelope.createdBy) === context.email;
	if (!isCreator && signerRecipients.length === 0) return null;

	const role = getHistoryRole(isCreator, signerRecipients.length > 0);
	return {
		envelopeId: context.envelope.id,
		title: `Document ${context.envelope.id.slice(0, 8)}`,
		status: context.envelope.status,
		state: getHistoryState(context.envelope.status),
		documentType:
			context.envelope.signingMode === "only_me" ? "self_signed" : "signed_with_partner",
		role,
		createdAt: context.envelope.createdAt.toISOString(),
		action: getHistoryAction({
			...context,
			isCreator,
			signerRecipients,
		}),
		creatorActions: getCreatorActions(context.envelope.status, isCreator),
	};
}

function getHistoryRole(isCreator: boolean, isSigner: boolean): DocumentHistoryRole {
	if (isCreator && isSigner) return "creator_and_signer";
	return isCreator ? "creator" : "signer";
}

function getHistoryState(status: EnvelopeStatus): DocumentHistoryState {
	if (status === "completed") return "completed";
	if (status === "draft" || status === "awaiting_verification") return "draft";
	return "in_progress";
}

function getCreatorActions(
	status: EnvelopeStatus,
	isCreator: boolean,
): DocumentHistoryCreatorAction[] {
	if (!isCreator || status === "deleted") return [];
	const actions: DocumentHistoryCreatorAction[] = [];
	if (status === "sent" || status === "changes_requested") {
		actions.push({ action: "cancel", label: "Cancel" });
	}
	actions.push({ action: "delete", label: "Delete" });
	return actions;
}

function getHistoryAction(
	context: HistoryContext & {
		isCreator: boolean;
		signerRecipients: Recipient[];
	},
): DocumentHistoryAction | null {
	if (context.envelope.status === "completed") return completedAction(context);
	const signerAction = resumeSigningAction(
		context.signerRecipients,
		context.signerTokens,
		context.now,
	);
	if (signerAction) return signerAction;
	if (!context.isCreator) return null;
	return creatorResumeAction(context.envelope, context.senderSessionToken);
}

function completedAction(
	context: HistoryContext & {
		signerRecipients: Recipient[];
	},
): DocumentHistoryAction | null {
	const signerToken = latestUsableSignerTokenForRecipients(
		context.signerRecipients,
		context.signerTokens,
		context.now,
	);
	const token = signerToken?.token ?? context.finalDocument?.id;
	if (!token) return null;
	return {
		type: "completed",
		label: "View completed",
		url: `/completed-documents/${token}`,
		downloadUrl: `/api/final-documents/${token}/pdf`,
	};
}

function resumeSigningAction(
	recipients: Recipient[],
	tokens: SignerToken[],
	now: Date,
): DocumentHistoryAction | null {
	const token = latestUsableSignerTokenForRecipients(recipients, tokens, now);
	if (!token) return null;
	return {
		type: "resume",
		label: "Resume signing",
		url: `/signing/${token.token}`,
	};
}

function creatorResumeAction(
	envelope: Envelope,
	senderSessionToken: string,
): DocumentHistoryAction | null {
	if (envelope.status === "draft" || envelope.status === "awaiting_verification") {
		return {
			type: "resume",
			label: "Resume draft",
			url: sourceUploadUrl(envelope.id, senderSessionToken),
		};
	}
	if (envelope.status === "changes_requested") {
		return {
			type: "resume",
			label: "Resume changes",
			url: sourceUploadUrl(envelope.id, senderSessionToken),
		};
	}
	if (envelope.status === "sent") {
		return {
			type: "resume",
			label: "Review status",
			url: `/envelope-fields?${new URLSearchParams({
				envelopeId: envelope.id,
				senderSessionToken,
			}).toString()}`,
		};
	}
	return null;
}

function sourceUploadUrl(envelopeId: string, senderSessionToken: string): string {
	return `/source-pdf-upload?${new URLSearchParams({
		envelopeId,
		senderSessionToken,
	}).toString()}`;
}

function latestUsableSignerTokenForRecipients(
	recipients: Recipient[],
	tokens: SignerToken[],
	now: Date,
): SignerToken | null {
	const recipientIds = new Set(recipients.map((recipient) => recipient.id));
	return (
		tokens
			.filter(
				(token) =>
					token.status === "active" && recipientIds.has(token.recipientId) && token.expiresAt > now,
			)
			.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
	);
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
