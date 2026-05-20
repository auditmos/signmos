import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { type Envelope, EnvelopeSchema, type FinalDocument, FinalDocumentSchema } from "./schema";
import {
	auditEvents,
	envelopeFields,
	envelopes,
	fieldValues,
	finalDocuments,
	sourceDocuments,
} from "./table";

interface FinalizeEnvelopeOptions {
	documentsBucket?: R2Bucket;
}

export interface EnvelopeFinalizationStatus {
	envelopeId: string;
	status: Envelope["status"];
	finalPdfAvailable: boolean;
}

export async function finalizeCompletedEnvelope(
	envelopeId: string,
	options: FinalizeEnvelopeOptions = {},
) {
	if (!options.documentsBucket) return null;

	const db = getDb();
	const [sourceDocument] = await db
		.select()
		.from(sourceDocuments)
		.where(eq(sourceDocuments.envelopeId, envelopeId))
		.limit(1);
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
	const bytes = new TextEncoder().encode(buildFinalPdf(envelopeId, rows));
	const r2Key = `envelopes/${envelopeId}/final.pdf`;
	await options.documentsBucket.put(r2Key, bytes, {
		httpMetadata: { contentType: "application/pdf" },
	});

	const [document] = await db
		.insert(finalDocuments)
		.values({
			envelopeId,
			r2Key,
			sha256: await sha256Hex(bytes),
			byteSize: bytes.byteLength,
			contentType: "application/pdf",
		})
		.returning();
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
		finalPdfAvailable: Boolean(finalDocument),
	};
}

export async function getFinalDocument(envelopeId: string): Promise<FinalDocument | null> {
	const db = getDb();
	const [document] = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, envelopeId))
		.limit(1);
	return document ? FinalDocumentSchema.parse(document) : null;
}

function buildFinalPdf(
	envelopeId: string,
	rows: {
		fields: Array<Record<string, unknown>>;
		values: Array<Record<string, unknown>>;
		events: Array<Record<string, unknown>>;
	},
): string {
	const valueByField = new Map(rows.values.map((value) => [value.fieldId, String(value.value)]));
	const flattenedFields = rows.fields.map((field) =>
		[
			String(field.type),
			`page=${field.page}`,
			`x=${field.x}`,
			`y=${field.y}`,
			`width=${field.width}`,
			`height=${field.height}`,
			`value=${valueByField.get(field.id) ?? ""}`,
		].join(" "),
	);
	const auditSummary = rows.events.map((event) =>
		[event.eventType, event.message].filter(Boolean).join(": "),
	);

	const contentLines = [
		`ENVELOPE ${envelopeId}`,
		"FLATTENED FIELDS",
		...flattenedFields,
		"AUDIT SUMMARY",
		...auditSummary,
	];
	const content = [
		"BT",
		"/F1 10 Tf",
		"72 760 Td",
		...contentLines.flatMap((line, index) => [
			index === 0 ? "" : "0 -14 Td",
			`(${escapePdfText(line)}) Tj`,
		]),
		"ET",
	]
		.filter(Boolean)
		.join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
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

function escapePdfText(text: string): string {
	return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
