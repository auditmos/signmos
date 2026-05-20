import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	type AttachSourceDocumentInput,
	type CreateEnvelopeInput,
	type Envelope,
	EnvelopeSchema,
	type SourceDocument,
	SourceDocumentSchema,
} from "./schema";
import { envelopes, idempotencyRecords, sourceDocuments } from "./table";

const createEnvelopeOperation = "envelope.create";
const uploadSourcePdfOperation = "source-pdf.upload";

export interface CreateEnvelopeResult {
	envelope: Envelope;
	reused: boolean;
}

export interface AttachSourceDocumentResult {
	document: SourceDocument;
	reused: boolean;
}

export async function createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
	const db = getDb();
	if (input.idempotencyKey) {
		const [record] = await db
			.select()
			.from(idempotencyRecords)
			.where(
				and(
					eq(idempotencyRecords.key, input.idempotencyKey),
					eq(idempotencyRecords.operation, createEnvelopeOperation),
					eq(idempotencyRecords.createdBy, input.createdBy),
				),
			)
			.limit(1);
		if (record) {
			const [envelope] = await db
				.select()
				.from(envelopes)
				.where(eq(envelopes.id, record.envelopeId))
				.limit(1);
			if (!envelope) throw new Error("Idempotent envelope result not found");
			return { envelope: EnvelopeSchema.parse(envelope), reused: true };
		}
	}

	const [envelope] = await db
		.insert(envelopes)
		.values({ createdBy: input.createdBy, status: "draft" })
		.returning();
	if (!envelope) throw new Error("Failed to create envelope");

	if (input.idempotencyKey) {
		await db
			.insert(idempotencyRecords)
			.values({
				key: input.idempotencyKey,
				operation: createEnvelopeOperation,
				createdBy: input.createdBy,
				envelopeId: envelope.id,
			})
			.returning();
	}

	return { envelope: EnvelopeSchema.parse(envelope), reused: false };
}

export async function attachSourceDocument(
	input: AttachSourceDocumentInput,
): Promise<AttachSourceDocumentResult> {
	const db = getDb();
	const [envelope] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, input.envelopeId))
		.limit(1);
	const parsedEnvelope = envelope ? EnvelopeSchema.parse(envelope) : null;
	if (!parsedEnvelope) throw new Error("Envelope not found");
	if (parsedEnvelope.status !== "draft") throw new Error("Envelope must be draft");

	if (input.idempotencyKey) {
		const [record] = await db
			.select()
			.from(idempotencyRecords)
			.where(
				and(
					eq(idempotencyRecords.key, input.idempotencyKey),
					eq(idempotencyRecords.operation, uploadSourcePdfOperation),
					eq(idempotencyRecords.createdBy, input.uploadedBy),
				),
			)
			.limit(1);
		if (record) {
			const [document] = await db
				.select()
				.from(sourceDocuments)
				.where(eq(sourceDocuments.envelopeId, record.envelopeId))
				.limit(1);
			if (!document) throw new Error("Idempotent source document result not found");
			return { document: SourceDocumentSchema.parse(document), reused: true };
		}
	}

	const [document] = await db
		.insert(sourceDocuments)
		.values({
			envelopeId: input.envelopeId,
			r2Key: input.r2Key,
			sha256: input.sha256,
			byteSize: input.byteSize,
			contentType: input.contentType,
			uploadedBy: input.uploadedBy,
		})
		.returning();
	if (!document) throw new Error("Failed to attach source document");

	if (input.idempotencyKey) {
		await db
			.insert(idempotencyRecords)
			.values({
				key: input.idempotencyKey,
				operation: uploadSourcePdfOperation,
				createdBy: input.uploadedBy,
				envelopeId: input.envelopeId,
			})
			.returning();
	}

	return { document: SourceDocumentSchema.parse(document), reused: false };
}
