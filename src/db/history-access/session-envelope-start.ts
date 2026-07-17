import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
	auditEvents,
	EnvelopeSchema,
	envelopes,
	idempotencyRecords,
	SigningModeSchema,
} from "@/db/envelope";
import { getDb } from "@/db/setup";
import { normalizeHistoryEmail } from "./request";
import { recordHistoryEnvelopeSecurityEvent } from "./security-audit";

const historyEnvelopeStartOperation = "history.envelope.start";

export const HistoryEnvelopeStartRequestSchema = z.object({
	name: z.string().trim().min(1).max(120),
	signingMode: SigningModeSchema,
});

export type HistoryEnvelopeStartRequest = z.infer<typeof HistoryEnvelopeStartRequestSchema>;

export interface HistoryEnvelopeStartResult {
	envelopeId: string;
	status: "draft";
	signingMode: HistoryEnvelopeStartRequest["signingMode"];
	sender: { name: string; email: string };
	redirectUrl: string;
	reused: boolean;
}

export async function startHistoryEnvelope(input: {
	session: { id: string; email: string };
	request: HistoryEnvelopeStartRequest;
	idempotencyKey: string;
	requestIp?: string | null;
}): Promise<HistoryEnvelopeStartResult> {
	const db = getDb();
	const email = normalizeHistoryEmail(input.session.email);
	const existingRecords = await db
		.select()
		.from(idempotencyRecords)
		.where(
			and(
				eq(idempotencyRecords.key, input.idempotencyKey),
				eq(idempotencyRecords.operation, historyEnvelopeStartOperation),
				eq(idempotencyRecords.createdBy, email),
			),
		)
		.limit(1);
	const existingRecord = existingRecords[0];
	if (existingRecord) {
		const existingRows = await db
			.select()
			.from(envelopes)
			.where(eq(envelopes.id, existingRecord.envelopeId))
			.limit(1);
		const envelope = EnvelopeSchema.parse(existingRows[0]);
		return toResult(envelope, envelope.createdByName ?? input.request.name, true);
	}

	const [createdRow] = await db
		.insert(envelopes)
		.values({
			status: "draft",
			signingMode: input.request.signingMode,
			createdBy: email,
			createdByName: input.request.name,
		})
		.returning();
	const envelope = EnvelopeSchema.parse(createdRow);
	await db
		.insert(idempotencyRecords)
		.values({
			key: input.idempotencyKey,
			operation: historyEnvelopeStartOperation,
			createdBy: email,
			envelopeId: envelope.id,
		})
		.returning();
	await db
		.insert(auditEvents)
		.values([
			{
				envelopeId: envelope.id,
				recipientId: null,
				eventType: "sender.start.created",
				message: email,
			},
			{
				envelopeId: envelope.id,
				recipientId: null,
				eventType: "sender.verified",
				message: email,
			},
		])
		.returning();
	await recordHistoryEnvelopeSecurityEvent({
		session: input.session,
		envelopeId: envelope.id,
		eventType: "history.creator.started",
		requestIp: input.requestIp,
	});
	return toResult(envelope, input.request.name, false);
}

function toResult(
	envelope: z.infer<typeof EnvelopeSchema>,
	name: string,
	reused: boolean,
): HistoryEnvelopeStartResult {
	return {
		envelopeId: envelope.id,
		status: "draft",
		signingMode: envelope.signingMode,
		sender: { name, email: envelope.createdBy },
		redirectUrl: `/my-documents/${envelope.id}/manage`,
		reused,
	};
}
