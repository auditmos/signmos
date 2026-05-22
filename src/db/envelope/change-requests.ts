import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	type ChangeRequestSigningRequest,
	type ChangeRequestSigningResult,
	EnvelopeSchema,
	getEnvelopeAllowedActions,
	type SignerToken,
} from "./schema";
import { auditEvents, emailSendRecords, envelopes } from "./table";

export class SigningChangeRequestError extends Error {
	constructor(public readonly code: "ENVELOPE_NOT_SENT") {
		super("Envelope is not open for change requests");
		this.name = "SigningChangeRequestError";
	}
}

export async function requestSigningChanges(
	token: SignerToken,
	input: ChangeRequestSigningRequest,
): Promise<ChangeRequestSigningResult> {
	const db = getDb();
	const [envelopeRow] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, token.envelopeId))
		.limit(1);
	const envelope = envelopeRow ? EnvelopeSchema.parse(envelopeRow) : null;
	if (!envelope) throw new Error("Envelope not found");
	if (envelope.status !== "sent") throw new SigningChangeRequestError("ENVELOPE_NOT_SENT");

	await db
		.update(envelopes)
		.set({ status: "changes_requested" })
		.where(eq(envelopes.id, token.envelopeId));
	await db
		.insert(emailSendRecords)
		.values({
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			tokenId: token.id,
			email: envelope.createdBy,
			kind: "change_request",
			fallbackUrl: buildRevisionUploadUrl(token.envelopeId, input.comment),
		})
		.returning();
	await db
		.insert(auditEvents)
		.values([
			{
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				eventType: "partner.change_requested",
				message: input.comment,
			},
			{
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				eventType: "sender.change_request.notified",
				message: envelope.createdBy,
			},
		])
		.returning();

	return {
		envelopeId: token.envelopeId,
		recipientId: token.recipientId,
		recipientStatus: "sent",
		envelopeStatus: "changes_requested",
		allowedActions: getEnvelopeAllowedActions("changes_requested"),
	};
}

function buildRevisionUploadUrl(envelopeId: string, comment: string): string {
	const params = new URLSearchParams({
		envelopeId,
		changeRequestComment: comment,
	});
	return `/source-pdf-upload?${params.toString()}`;
}
