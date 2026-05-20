import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { type CreateEnvelopeInput, type Envelope, EnvelopeSchema } from "./schema";
import { envelopes, idempotencyRecords } from "./table";

const createEnvelopeOperation = "envelope.create";

export interface CreateEnvelopeResult {
	envelope: Envelope;
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
