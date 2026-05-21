import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	type Envelope,
	EnvelopeSchema,
	type FinalDocument,
	FinalDocumentSchema,
	getEnvelopeAllowedActions,
	RecipientSchema,
	SenderVerificationTokenSchema,
	type SignerToken,
	SignerTokenSchema,
	type SourceDocument,
	SourceDocumentSchema,
} from "./schema";
import {
	auditEvents,
	emailSendRecords,
	envelopeFields,
	envelopeRecipients,
	envelopes,
	fieldValues,
	finalDocuments,
	senderVerificationEmailRecords,
	senderVerificationTokens,
	signerTokens,
	sourceDocuments,
} from "./table";

interface FinalizeEnvelopeOptions {
	documentsBucket?: R2Bucket;
}

export interface EnvelopeFinalizationStatus {
	envelopeId: string;
	status: Envelope["status"];
	finalPdfAvailable: boolean;
	allowedActions: string[];
}

export async function finalizeCompletedEnvelope(
	envelopeId: string,
	options: FinalizeEnvelopeOptions = {},
) {
	if (!options.documentsBucket) return null;

	const db = getDb();
	const sourceDocumentRows = await db
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.envelopeId, envelopeId))
		.limit(100);
	const sourceDocument = latestSourceDocument(
		sourceDocumentRows.map((document) => SourceDocumentSchema.parse(document)),
	);
	if (!sourceDocument) throw new Error("Envelope source PDF required");

	const rows = {
		fields: await db
			.select()
			.from(envelopeFields)
			.where(eq(envelopeFields.envelopeId, envelopeId))
			.limit(100),
		values: await db
			.select()
			.from(fieldValues)
			.where(eq(fieldValues.envelopeId, envelopeId))
			.limit(100),
		events: await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.envelopeId, envelopeId))
			.limit(100),
	};
	const encoder = new TextEncoder();
	const certificateHash = await sha256Hex(
		encoder.encode(buildCertificateMaterial(sourceDocument, rows)),
	);
	const bytes = encoder.encode(buildFinalPdf(envelopeId, sourceDocument, rows, certificateHash));
	const r2Key = `envelopes/${envelopeId}/final.pdf`;
	await options.documentsBucket.put(r2Key, bytes, {
		httpMetadata: { contentType: "application/pdf" },
	});

	const finalSha256 = await sha256Hex(bytes);
	const [document] = await db
		.insert(finalDocuments)
		.values({
			envelopeId,
			r2Key,
			sha256: finalSha256,
			byteSize: bytes.byteLength,
			contentType: "application/pdf",
		})
		.returning();
	await recordCompletionNotifications(envelopeId);
	return document ? FinalDocumentSchema.parse(document) : null;
}

export async function getEnvelopeFinalizationStatus(
	envelopeId: string,
): Promise<EnvelopeFinalizationStatus> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	const [finalDocument] = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, envelopeId))
		.limit(1);

	return {
		envelopeId,
		status: parsedEnvelope.status,
		finalPdfAvailable: parsedEnvelope.status === "completed" && Boolean(finalDocument),
		allowedActions: getEnvelopeAllowedActions(parsedEnvelope.status),
	};
}

export async function getFinalDocument(envelopeId: string): Promise<FinalDocument | null> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope || parsedEnvelope.status !== "completed") return null;

	const [document] = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, envelopeId))
		.limit(1);
	return document ? FinalDocumentSchema.parse(document) : null;
}

export async function getSignerFinalDocument(token: SignerToken): Promise<FinalDocument | null> {
	return getFinalDocument(token.envelopeId);
}

function buildFinalPdf(
	envelopeId: string,
	sourceDocument: SourceDocument,
	rows: {
		fields: Array<Record<string, unknown>>;
		values: Array<Record<string, unknown>>;
		events: Array<Record<string, unknown>>;
	},
	certificateHash: string,
): string {
	const flattenedFields = buildFlattenedFieldLines(rows);
	const eventSummary = buildEventSummaryLines(rows.events);
	const pageOneContent = [
		...textBlock([`ENVELOPE ${envelopeId}`, "FLATTENED FIELDS"], 72, 760, 10, 14),
		...flattenedFields.flatMap((line, index) => {
			const field = rows.fields[index];
			const value = line.split(" value=")[1] ?? "";
			const x = numberValue(field, "x", 72);
			const y = numberValue(field, "y", 144);
			const height = numberValue(field, "height", 32);
			const baseline = Math.max(36, 792 - y - height);
			return [
				...textBlock([value], x, baseline, 12, 14),
				...textBlock([line], x, baseline - 12, 7, 9),
			];
		}),
	].join("\n");
	const pageTwoContent = textBlock(
		[
			"AUDIT CERTIFICATE",
			`Envelope: ${envelopeId}`,
			`Source SHA-256: ${sourceDocument.sha256}`,
			`Certificate checksum: ${certificateHash}`,
			"SIGNING EVENT SUMMARY",
			...eventSummary,
		],
		72,
		760,
		10,
		14,
	);
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${pageOneContent.length} >>\nstream\n${pageOneContent}\nendstream`,
		`<< /Length ${pageTwoContent.length} >>\nstream\n${pageTwoContent}\nendstream`,
	];
	let pdf = "%PDF-1.4\n";
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xrefOffset = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += "0000000000 65535 f \n";
	for (const offset of offsets.slice(1)) {
		pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
	pdf += `startxref\n${xrefOffset}\n%%EOF`;
	return pdf;
}

async function recordCompletionNotifications(envelopeId: string): Promise<void> {
	const db = getDb();
	const recipients = (
		await db
			.select()
			.from(envelopeRecipients)
			.where(eq(envelopeRecipients.envelopeId, envelopeId))
			.limit(100)
	).map((recipient) => RecipientSchema.parse(recipient));
	const tokens = (
		await db.select().from(signerTokens).where(eq(signerTokens.envelopeId, envelopeId)).limit(100)
	).map((token) => SignerTokenSchema.parse(token));
	const partnerRecords = recipients.flatMap((recipient) => {
		const token = latestSignerToken(tokens, recipient.id);
		if (!token) return [];
		return [
			{
				envelopeId,
				recipientId: recipient.id,
				tokenId: token.id,
				email: recipient.email,
				kind: "completion",
				fallbackUrl: `/api/signing/${token.token}/final-pdf`,
			},
		];
	});
	if (partnerRecords.length > 0) {
		await db.insert(emailSendRecords).values(partnerRecords).returning();
	}

	const senderTokens = (
		await db
			.select()
			.from(senderVerificationTokens)
			.where(eq(senderVerificationTokens.envelopeId, envelopeId))
			.limit(100)
	).map((token) => SenderVerificationTokenSchema.parse(token));
	const senderToken = latestVerifiedSenderToken(senderTokens);
	if (senderToken) {
		await db
			.insert(senderVerificationEmailRecords)
			.values({
				envelopeId,
				tokenId: senderToken.id,
				email: senderToken.email,
				kind: "completion",
				fallbackUrl: `/api/envelopes/${envelopeId}/final-pdf?senderSessionToken=${encodeURIComponent(senderToken.token)}`,
			})
			.returning();
	}
}

function buildCertificateMaterial(
	sourceDocument: SourceDocument,
	rows: {
		fields: Array<Record<string, unknown>>;
		values: Array<Record<string, unknown>>;
		events: Array<Record<string, unknown>>;
	},
): string {
	return [
		`source:${sourceDocument.sha256}`,
		"fields:",
		...buildFlattenedFieldLines(rows),
		"events:",
		...buildEventSummaryLines(rows.events),
	].join("\n");
}

function buildFlattenedFieldLines(rows: {
	fields: Array<Record<string, unknown>>;
	values: Array<Record<string, unknown>>;
}): string[] {
	const valueByField = new Map(
		rows.values.map((value) => [stringValue(value, "fieldId"), stringValue(value, "value")]),
	);
	return rows.fields.map((field) =>
		[
			stringValue(field, "type"),
			`page=${stringValue(field, "page")}`,
			`x=${stringValue(field, "x")}`,
			`y=${stringValue(field, "y")}`,
			`width=${stringValue(field, "width")}`,
			`height=${stringValue(field, "height")}`,
			`value=${valueByField.get(stringValue(field, "id")) ?? ""}`,
		].join(" "),
	);
}

function buildEventSummaryLines(events: Array<Record<string, unknown>>): string[] {
	return events.map((event) =>
		[stringValue(event, "eventType"), stringValue(event, "message")].filter(Boolean).join(": "),
	);
}

function textBlock(
	lines: string[],
	x: number,
	y: number,
	fontSize: number,
	leading: number,
): string[] {
	return [
		"BT",
		`/F1 ${fontSize} Tf`,
		`${x} ${y} Td`,
		...lines.flatMap((line, index) => [
			index === 0 ? "" : `0 -${leading} Td`,
			`(${escapePdfText(line)}) Tj`,
		]),
		"ET",
	].filter(Boolean);
}

function latestSourceDocument(documents: SourceDocument[]): SourceDocument | null {
	return [...documents].sort((left, right) => right.version - left.version)[0] ?? null;
}

function latestSignerToken(
	tokens: ReturnType<typeof SignerTokenSchema.parse>[],
	recipientId: string,
) {
	return [...tokens]
		.filter((token) => token.recipientId === recipientId)
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

function latestVerifiedSenderToken(
	tokens: ReturnType<typeof SenderVerificationTokenSchema.parse>[],
) {
	return [...tokens]
		.filter((token) => token.status === "verified")
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

function stringValue(row: Record<string, unknown> | undefined, key: string): string {
	const value = row?.[key];
	if (value instanceof Date) return value.toISOString();
	return value == null ? "" : String(value);
}

function numberValue(
	row: Record<string, unknown> | undefined,
	key: string,
	fallback: number,
): number {
	const value = Number(row?.[key]);
	return Number.isFinite(value) ? value : fallback;
}

function escapePdfText(text: string): string {
	return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
