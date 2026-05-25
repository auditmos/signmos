import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	type EnvelopeField,
	EnvelopeFieldSchema,
	EnvelopeSchema,
	type FinalDocument,
	FinalDocumentSchema,
	type Recipient,
	RecipientSchema,
	SignerTokenSchema,
} from "./schema";
import {
	auditEvents,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	signerTokens,
} from "./table";

export interface CompletedDocumentLink {
	url: string;
	downloadUrl: string;
}

export interface CompletedDocumentView {
	token: string;
	envelopeId: string;
	status: "completed";
	finalPdf: {
		downloadUrl: string;
		contentType: "application/pdf";
		byteSize: number;
		sha256: string;
		createdAt: string | null;
	};
	parties: CompletedDocumentParty[];
	history: CompletedDocumentHistoryEvent[];
}

interface CompletedDocumentParty {
	id: string;
	name: string;
	email: string;
	status: string;
	signedDate: string | null;
	signedAt: string | null;
}

interface CompletedDocumentHistoryEvent {
	type: string;
	title: string;
	detail: string | null;
	occurredAt: string;
}

interface FieldValueSnapshot {
	recipientId: string;
	fieldId: string;
	value: string;
	completedAt: Date | null;
}

interface CompletedDocumentContext {
	finalDocument: FinalDocument;
	recipients: Recipient[];
	fields: EnvelopeField[];
	values: FieldValueSnapshot[];
	events: Array<Record<string, unknown>>;
}

export async function getCompletedDocumentView(
	token: string,
	options: { now?: Date } = {},
): Promise<CompletedDocumentView | null> {
	const context = await getCompletedDocumentContext(token, options);
	if (!context) return null;

	return {
		token,
		envelopeId: context.finalDocument.envelopeId,
		status: "completed",
		finalPdf: {
			downloadUrl: completedDocumentDownloadUrl(token),
			contentType: context.finalDocument.contentType,
			byteSize: context.finalDocument.byteSize,
			sha256: context.finalDocument.sha256,
			createdAt: context.finalDocument.createdAt?.toISOString() ?? null,
		},
		parties: buildParties(context),
		history: buildHistory(context),
	};
}

export async function getFinalDocumentByToken(
	token: string,
	options: { now?: Date } = {},
): Promise<FinalDocument | null> {
	const context = await getCompletedDocumentContext(token, options);
	return context?.finalDocument ?? null;
}

export async function getCompletedDocumentLinkForSignerToken(
	tokenValue: string,
	options: { now?: Date } = {},
): Promise<CompletedDocumentLink | null> {
	const db = getDb();
	const tokenRows = await db
		.select()
		.from(signerTokens)
		.where(eq(signerTokens.token, tokenValue))
		.limit(1);
	const token =
		tokenRows.map((row) => SignerTokenSchema.parse(row)).find((row) => row.token === tokenValue) ??
		null;
	if (!token) return null;
	if (token.expiresAt <= (options.now ?? new Date())) return null;

	const [envelopeRow] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, token.envelopeId))
		.limit(1);
	const envelope = envelopeRow ? EnvelopeSchema.parse(envelopeRow) : null;
	if (envelope?.status !== "completed") return null;

	const documentRows = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, token.envelopeId))
		.limit(1);
	const finalDocument =
		documentRows
			.map((row) => FinalDocumentSchema.parse(row))
			.find((document) => document.envelopeId === token.envelopeId && document.id) ?? null;
	if (!finalDocument?.id) return null;
	return completedDocumentLink(token.token);
}

function completedDocumentLink(token: string): CompletedDocumentLink {
	return {
		url: `/completed-documents/${token}`,
		downloadUrl: completedDocumentDownloadUrl(token),
	};
}

function completedDocumentDownloadUrl(token: string): string {
	return `/api/final-documents/${token}/pdf`;
}

async function getCompletedDocumentContext(
	token: string,
	options: { now?: Date } = {},
): Promise<CompletedDocumentContext | null> {
	const signerContext = await getCompletedDocumentContextForSignerToken(token, options);
	if (signerContext) return signerContext;

	const db = getDb();
	const documentRows = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.id, token))
		.limit(1);
	const finalDocument =
		documentRows
			.map((row) => FinalDocumentSchema.parse(row))
			.find((document) => document.id === token) ?? null;
	if (!finalDocument) return null;

	const [envelopeRow] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, finalDocument.envelopeId))
		.limit(1);
	const envelope = envelopeRow ? EnvelopeSchema.parse(envelopeRow) : null;
	if (envelope?.status !== "completed") return null;

	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, finalDocument.envelopeId))
			.limit(100)
	).map((recipient) => RecipientSchema.parse(recipient));
	const fields = (
		await db
			.select()
			.from(envelopeFields)
			.where(eq(envelopeFields.envelopeId, finalDocument.envelopeId))
			.limit(100)
	).map((field) => EnvelopeFieldSchema.parse(field));
	const values = (
		await db
			.select()
			.from(fieldValues)
			.where(eq(fieldValues.envelopeId, finalDocument.envelopeId))
			.limit(100)
	)
		.map((value) => normalizeFieldValue(value as Record<string, unknown>))
		.filter((value): value is FieldValueSnapshot => Boolean(value));
	const events = await db
		.select()
		.from(auditEvents)
		.where(eq(auditEvents.envelopeId, finalDocument.envelopeId))
		.limit(100);

	return { finalDocument, recipients, fields, values, events };
}

async function getCompletedDocumentContextForSignerToken(
	tokenValue: string,
	options: { now?: Date },
): Promise<CompletedDocumentContext | null> {
	const db = getDb();
	const tokenRows = await db
		.select()
		.from(signerTokens)
		.where(eq(signerTokens.token, tokenValue))
		.limit(1);
	const token =
		tokenRows.map((row) => SignerTokenSchema.parse(row)).find((row) => row.token === tokenValue) ??
		null;
	if (!token) return null;
	if (token.expiresAt <= (options.now ?? new Date())) return null;
	const documentRows = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, token.envelopeId))
		.limit(1);
	const finalDocument =
		documentRows
			.map((row) => FinalDocumentSchema.parse(row))
			.find((document) => document.envelopeId === token.envelopeId) ?? null;
	if (!finalDocument?.id) return null;
	const context = await getCompletedDocumentContext(finalDocument.id, options);
	if (!context) return null;
	return context;
}

function buildParties(context: CompletedDocumentContext | null) {
	if (!context) return [];
	const dateFieldIdsByRecipient = new Map(
		context.fields
			.filter((field) => field.type === "date")
			.map((field) => [field.recipientId, field.id]),
	);
	return context.recipients.map((recipient) => {
		const recipientValues = context.values.filter((value) => value.recipientId === recipient.id);
		const dateFieldId = dateFieldIdsByRecipient.get(recipient.id);
		const signedDate =
			recipientValues.find((value) => value.fieldId === dateFieldId)?.value ?? null;
		const signedAt = latestDate(recipientValues.map((value) => value.completedAt));
		return {
			id: recipient.id,
			name: recipient.name,
			email: recipient.email,
			status: recipient.status,
			signedDate,
			signedAt: signedAt?.toISOString() ?? null,
		};
	});
}

function buildHistory(context: CompletedDocumentContext | null) {
	if (!context) return [];
	const recipientNameById = new Map(
		context.recipients.map((recipient) => [recipient.id, recipient.name]),
	);
	return context.events
		.map((event) => toPublicHistoryEvent(event as Record<string, unknown>, recipientNameById))
		.filter((event): event is CompletedDocumentHistoryEvent => Boolean(event))
		.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function toPublicHistoryEvent(
	event: Record<string, unknown>,
	recipientNameById: Map<string, string>,
): CompletedDocumentHistoryEvent | null {
	const eventType = stringValue(event.eventType);
	const occurredAt = dateValue(event.createdAt)?.toISOString();
	if (!occurredAt) return null;
	const recipientName = recipientNameById.get(stringValue(event.recipientId)) ?? "Signer";
	const detail = nullableString(event.message);
	const base = { detail, occurredAt };

	if (eventType === "source_pdf.uploaded") {
		return { ...base, type: "document_uploaded", title: "Document uploaded" };
	}
	if (eventType === "source_pdf.revised") {
		return { ...base, type: "document_revised", title: "Document revised" };
	}
	if (eventType === "envelope.sent") {
		return { ...base, type: "sent", title: "Envelope sent" };
	}
	if (eventType === "partner.signing.viewed") {
		return { ...base, type: "viewed", title: `${recipientName} viewed the document` };
	}
	if (eventType === "sender.completed" || eventType === "recipient.completed") {
		return { ...base, type: "signed", title: `${recipientName} signed` };
	}
	if (eventType === "partner.change_requested") {
		return { ...base, type: "changes_requested", title: `${recipientName} requested changes` };
	}
	if (eventType === "recipient.declined") {
		return { ...base, type: "declined", title: `${recipientName} declined` };
	}
	if (eventType === "envelope.canceled") {
		return { ...base, type: "canceled", title: "Envelope canceled" };
	}
	if (eventType === "envelope.expired") {
		return { ...base, type: "expired", title: "Envelope expired" };
	}
	if (eventType === "envelope.deleted") {
		return { ...base, type: "deleted", title: "Envelope deleted" };
	}
	return null;
}

function normalizeFieldValue(row: Record<string, unknown>): FieldValueSnapshot | null {
	const recipientId = stringValue(row.recipientId);
	const fieldId = stringValue(row.fieldId);
	const value = stringValue(row.value);
	if (!recipientId || !fieldId || !value) return null;
	return {
		recipientId,
		fieldId,
		value,
		completedAt: dateValue(row.completedAt),
	};
}

function latestDate(values: Array<Date | null>): Date | null {
	return (
		values
			.filter((value): value is Date => value instanceof Date)
			.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
	);
}

function nullableString(value: unknown): string | null {
	const text = stringValue(value);
	return text || null;
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function dateValue(value: unknown): Date | null {
	return value instanceof Date ? value : null;
}
