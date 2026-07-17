import {
	auditEvents,
	type EnvelopeStatus,
	envelopeRecipients,
	envelopes,
	senderVerificationTokens,
	sourceDocuments,
} from "@/db/envelope";
import { getDb } from "@/db/setup";
import { normalizeHistoryEmail } from "./request";

export const historyCatalogPageSize = 25;
export const historyCatalogRoles = ["creator", "signer", "creator_and_signer"] as const;
export const historyCatalogGroups = [
	"drafts",
	"needs_my_action",
	"waiting_on_others",
	"completed",
	"closed",
] as const;

export type HistoryCatalogRole = (typeof historyCatalogRoles)[number];
export type HistoryCatalogGroup = (typeof historyCatalogGroups)[number];
export type HistoryCatalogAction =
	| "resume"
	| "sign"
	| "review"
	| "view_completed"
	| "download_final_pdf"
	| "cancel"
	| "delete";

export interface HistoryCatalogParticipant {
	name: string;
	email: string;
	role: "creator" | "signer";
}

export interface HistoryCatalogItem {
	envelopeId: string;
	title: string;
	shortReference: string;
	status: EnvelopeStatus;
	group: HistoryCatalogGroup;
	role: HistoryCatalogRole;
	participants: HistoryCatalogParticipant[];
	allowedActions: HistoryCatalogAction[];
	createdAt: string;
	activityAt: string;
	detailUrl: string | null;
	downloadUrl: string | null;
}

export interface HistoryCatalogQuery {
	email: string;
	page: number;
	search?: string;
	role?: HistoryCatalogRole;
	group?: HistoryCatalogGroup;
	status?: EnvelopeStatus;
}

export interface HistoryCatalogResult {
	items: HistoryCatalogItem[];
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
	};
}

type EnvelopeRow = typeof envelopes.$inferSelect;
type RecipientRow = typeof envelopeRecipients.$inferSelect;
type SourceRow = typeof sourceDocuments.$inferSelect;
type SenderRow = typeof senderVerificationTokens.$inferSelect;
type AuditRow = typeof auditEvents.$inferSelect;

interface CatalogRows {
	envelopes: EnvelopeRow[];
	recipients: RecipientRow[];
	sources: SourceRow[];
	senders: SenderRow[];
	events: AuditRow[];
}

export async function listHistoryDocuments(
	query: HistoryCatalogQuery,
): Promise<HistoryCatalogResult> {
	const authorizedItems = await loadAuthorizedCatalog(query.email);
	const matchingItems = authorizedItems.filter((item) => matchesCatalogQuery(item, query));
	const totalItems = matchingItems.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / historyCatalogPageSize));
	const pageStart = (query.page - 1) * historyCatalogPageSize;
	return {
		items: matchingItems.slice(pageStart, pageStart + historyCatalogPageSize),
		pagination: {
			page: query.page,
			pageSize: historyCatalogPageSize,
			totalItems,
			totalPages,
		},
	};
}

export async function authorizeHistoryDocument(
	email: string,
	envelopeId: string,
): Promise<HistoryCatalogItem | null> {
	const items = await loadAuthorizedCatalog(email);
	return items.find((item) => item.envelopeId === envelopeId) ?? null;
}

export interface MinimalHistoryDocument {
	envelopeId: string;
	status: "completed";
	role: HistoryCatalogRole;
	detailUrl: string;
	downloadUrl: string;
}

export async function listMinimalHistoryDocuments(
	email: string,
): Promise<MinimalHistoryDocument[]> {
	return (await loadAuthorizedCatalog(email)).flatMap(toMinimalCompletedDocument);
}

export async function authorizeMinimalHistoryDocument(
	email: string,
	envelopeId: string,
): Promise<MinimalHistoryDocument | null> {
	const item = await authorizeHistoryDocument(email, envelopeId);
	return item ? (toMinimalCompletedDocument(item)[0] ?? null) : null;
}

async function loadAuthorizedCatalog(email: string): Promise<HistoryCatalogItem[]> {
	const normalizedEmail = normalizeHistoryEmail(email);
	const rows = await loadCatalogRows();
	return rows.envelopes
		.filter((envelope) => envelope.status !== "deleted")
		.flatMap((envelope) => projectAuthorizedEnvelope(envelope, normalizedEmail, rows))
		.sort(compareCatalogItems);
}

async function loadCatalogRows(): Promise<CatalogRows> {
	const db = getDb();
	const [envelopeRows, recipientRows, sourceRows, senderRows, eventRows] = await Promise.all([
		db.select().from(envelopes),
		db.select().from(envelopeRecipients),
		db.select().from(sourceDocuments),
		db.select().from(senderVerificationTokens),
		db.select().from(auditEvents),
	]);
	return {
		envelopes: envelopeRows,
		recipients: recipientRows,
		sources: sourceRows,
		senders: senderRows,
		events: eventRows,
	};
}

function projectAuthorizedEnvelope(
	envelope: EnvelopeRow,
	normalizedEmail: string,
	rows: CatalogRows,
): HistoryCatalogItem[] {
	const recipients = rows.recipients.filter((row) => row.envelopeId === envelope.id);
	const matchingRecipients = recipients.filter(
		(recipient) => normalizeHistoryEmail(recipient.email) === normalizedEmail,
	);
	const isCreator = normalizeHistoryEmail(envelope.createdBy) === normalizedEmail;
	if (!isCreator && matchingRecipients.length === 0) return [];
	const role = historyRole(isCreator, matchingRecipients.length > 0);
	const allowedActions = historyAllowedActions({
		status: envelope.status as EnvelopeStatus,
		isCreator,
		matchingRecipients,
	});
	const group = historyGroup({
		status: envelope.status as EnvelopeStatus,
		isCreator,
		allowedActions,
	});
	const latestSource = latestForEnvelope(rows.sources, envelope.id, (row) => row.version);
	const latestSender = latestForEnvelope(rows.senders, envelope.id, (row) =>
		row.createdAt.getTime(),
	);
	const activityAt = latestActivity(envelope, rows.events);
	return [
		{
			envelopeId: envelope.id,
			title: latestSource?.originalFilename || "Untitled document",
			shortReference: envelope.id.slice(0, 8),
			status: envelope.status as EnvelopeStatus,
			group,
			role,
			participants: projectParticipants(envelope, recipients, latestSender),
			allowedActions,
			createdAt: envelope.createdAt.toISOString(),
			activityAt: activityAt.toISOString(),
			detailUrl: envelope.status === "completed" ? `/my-documents/${envelope.id}` : null,
			downloadUrl:
				envelope.status === "completed" ? `/api/history/documents/${envelope.id}/pdf` : null,
		},
	];
}

function historyRole(isCreator: boolean, isSigner: boolean): HistoryCatalogRole {
	if (isCreator && isSigner) return "creator_and_signer";
	return isCreator ? "creator" : "signer";
}

function historyAllowedActions(input: {
	status: EnvelopeStatus;
	isCreator: boolean;
	matchingRecipients: RecipientRow[];
}): HistoryCatalogAction[] {
	const actions: HistoryCatalogAction[] = [];
	const canSign =
		input.status === "sent" &&
		input.matchingRecipients.some(
			(recipient) => recipient.status === "pending" || recipient.status === "sent",
		);
	if (canSign) actions.push("sign");
	if (input.isCreator) {
		if (input.status === "awaiting_verification" || input.status === "draft") {
			actions.push("resume");
		}
		if (input.status === "changes_requested") actions.push("resume", "cancel", "delete");
		if (input.status === "sent") actions.push("review", "cancel", "delete");
	}
	if (input.status === "completed") {
		actions.push("view_completed", "download_final_pdf");
		if (input.isCreator) actions.push("delete");
	}
	if (input.status === "expired" && input.isCreator) actions.push("delete");
	return actions;
}

function historyGroup(input: {
	status: EnvelopeStatus;
	isCreator: boolean;
	allowedActions: HistoryCatalogAction[];
}): HistoryCatalogGroup {
	if (input.status === "completed") return "completed";
	if (input.status === "declined" || input.status === "expired") return "closed";
	if (input.isCreator && (input.status === "awaiting_verification" || input.status === "draft")) {
		return "drafts";
	}
	if (input.allowedActions.includes("sign")) return "needs_my_action";
	if (input.status === "changes_requested") {
		return input.isCreator ? "needs_my_action" : "waiting_on_others";
	}
	return "waiting_on_others";
}

function projectParticipants(
	envelope: EnvelopeRow,
	recipients: RecipientRow[],
	latestSender: SenderRow | null,
): HistoryCatalogParticipant[] {
	return [
		{
			name: latestSender?.name ?? envelope.createdBy,
			email: envelope.createdBy,
			role: "creator" as const,
		},
		...recipients.map((recipient) => ({
			name: recipient.name,
			email: recipient.email,
			role: "signer" as const,
		})),
	];
}

function latestActivity(envelope: EnvelopeRow, events: AuditRow[]): Date {
	return events
		.filter((event) => event.envelopeId === envelope.id)
		.reduce(
			(latest, event) => (event.createdAt > latest ? event.createdAt : latest),
			envelope.createdAt,
		);
}

function latestForEnvelope<Row extends { envelopeId: string }>(
	rows: Row[],
	envelopeId: string,
	value: (row: Row) => number,
): Row | null {
	return (
		rows
			.filter((row) => row.envelopeId === envelopeId)
			.sort((left, right) => value(right) - value(left))[0] ?? null
	);
}

function compareCatalogItems(left: HistoryCatalogItem, right: HistoryCatalogItem): number {
	const leftPriority = left.group === "needs_my_action" ? 0 : 1;
	const rightPriority = right.group === "needs_my_action" ? 0 : 1;
	if (leftPriority !== rightPriority) return leftPriority - rightPriority;
	const activityOrder = right.activityAt.localeCompare(left.activityAt);
	return activityOrder || left.envelopeId.localeCompare(right.envelopeId);
}

function matchesCatalogQuery(item: HistoryCatalogItem, query: HistoryCatalogQuery): boolean {
	if (query.role && item.role !== query.role) return false;
	if (query.group && item.group !== query.group) return false;
	if (query.status && item.status !== query.status) return false;
	const search = query.search?.trim().toLowerCase();
	if (!search) return true;
	return [
		item.title,
		...item.participants.flatMap((participant) => [participant.name, participant.email]),
	].some((value) => value.toLowerCase().includes(search));
}

function toMinimalCompletedDocument(item: HistoryCatalogItem): MinimalHistoryDocument[] {
	if (item.status !== "completed" || !item.detailUrl || !item.downloadUrl) return [];
	return [
		{
			envelopeId: item.envelopeId,
			status: "completed",
			role: item.role,
			detailUrl: item.detailUrl,
			downloadUrl: item.downloadUrl,
		},
	];
}
