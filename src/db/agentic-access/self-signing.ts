import { eq } from "drizzle-orm";
import {
	activateSelfSignAfterFieldPreparation,
	addFields,
	auditEvents,
	createDefaultFieldPlacements,
	type Envelope,
	type EnvelopeField,
	EnvelopeSchema,
	envelopeRecipients,
	envelopes,
	getEnvelopeAllowedActions,
	getLatestSourcePdfDocument,
	type Recipient,
	RecipientSchema,
	type SignerToken,
	SignerTokenSchema,
	signerTokens,
} from "@/db/envelope";
import { getDb } from "@/db/setup";
import type { AgenticPrincipal } from "./bearer-principal";
import { appendAgenticSecurityEvent } from "./security-audit";

export interface AgentSelfSignDraft {
	documentId: string;
	status: "draft";
	signingMode: "only_me";
	sender: { name: string; email: string };
	allowedActions: string[];
}

export class AgentSelfSignPreparationError extends Error {
	constructor(
		public readonly code: "DOCUMENT_NOT_FOUND" | "PREPARATION_BLOCKED" | "SOURCE_REQUIRED",
	) {
		super(code);
		this.name = "AgentSelfSignPreparationError";
	}
}

export async function createAgentSelfSignDraft(input: {
	principal: AgenticPrincipal;
	name: string;
	requestIp?: string | null;
}): Promise<AgentSelfSignDraft> {
	const db = getDb();
	const email = input.principal.email.trim().toLowerCase();
	const [envelope] = await db
		.insert(envelopes)
		.values({
			status: "draft",
			signingMode: "only_me",
			createdBy: email,
			createdByName: input.name,
		})
		.returning();
	if (!envelope) throw new Error("Failed to create Agent self-sign draft");
	await db
		.insert(envelopeRecipients)
		.values({
			envelopeId: envelope.id,
			name: input.name,
			email,
			status: "pending",
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
	await appendAgenticSecurityEvent({
		tokenId: input.principal.token.id,
		tokenName: input.principal.token.name,
		documentId: envelope.id,
		email,
		eventType: "agentic.document.created",
		actorType: "agent",
		requestIp: input.requestIp,
	});
	return {
		documentId: envelope.id,
		status: "draft",
		signingMode: "only_me",
		sender: { name: input.name, email },
		allowedActions: getEnvelopeAllowedActions("draft"),
	};
}

export async function getAuthorizedAgentSelfSignEnvelope(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<Envelope | null> {
	const rows = await getDb().select().from(envelopes).where(eq(envelopes.id, documentId)).limit(1);
	const row = rows.find((candidate) => candidate.id === documentId);
	if (!row) return null;
	const envelope = EnvelopeSchema.parse(row);
	if (
		envelope.signingMode !== "only_me" ||
		envelope.status === "deleted" ||
		envelope.createdBy.trim().toLowerCase() !== principal.email.trim().toLowerCase()
	) {
		return null;
	}
	return envelope;
}

export async function getAuthorizedAgentSelfSignRecipient(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<Recipient | null> {
	if (!(await getAuthorizedAgentSelfSignEnvelope(principal, documentId))) return null;
	const rows = await getDb()
		.select()
		.from(envelopeRecipients)
		.where(eq(envelopeRecipients.envelopeId, documentId))
		.limit(10);
	const email = principal.email.trim().toLowerCase();
	const row = rows.find(
		(candidate) =>
			candidate.envelopeId === documentId && candidate.email.trim().toLowerCase() === email,
	);
	return row ? RecipientSchema.parse(row) : null;
}

export async function getAgentSelfSignToken(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<SignerToken | null> {
	const recipient = await getAuthorizedAgentSelfSignRecipient(principal, documentId);
	if (!recipient) return null;
	const rows = await getDb()
		.select()
		.from(signerTokens)
		.where(eq(signerTokens.envelopeId, documentId))
		.limit(100);
	const tokens = rows
		.filter(
			(candidate) =>
				candidate.envelopeId === documentId &&
				candidate.recipientId === recipient.id &&
				candidate.status === "active",
		)
		.map((candidate) => SignerTokenSchema.parse(candidate));
	return (
		tokens.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
	);
}

export async function prepareAgentSelfSignFields(input: {
	principal: AgenticPrincipal;
	documentId: string;
	placement:
		| { kind: "default"; page: number }
		| {
				kind: "explicit";
				fields: Array<{
					type: "signature" | "date";
					page: number;
					x: number;
					y: number;
					width: number;
					height: number;
				}>;
		  };
	now: Date;
}): Promise<EnvelopeField[]> {
	const envelope = await getAuthorizedAgentSelfSignEnvelope(input.principal, input.documentId);
	if (!envelope) throw new AgentSelfSignPreparationError("DOCUMENT_NOT_FOUND");
	if (envelope.status !== "draft") throw new AgentSelfSignPreparationError("PREPARATION_BLOCKED");
	if (!(await getLatestSourcePdfDocument(input.documentId))) {
		throw new AgentSelfSignPreparationError("SOURCE_REQUIRED");
	}
	const recipient = await getAuthorizedAgentSelfSignRecipient(input.principal, input.documentId);
	if (!recipient) throw new AgentSelfSignPreparationError("DOCUMENT_NOT_FOUND");
	const fields =
		input.placement.kind === "default"
			? await createDefaultFieldPlacements({
					envelopeId: input.documentId,
					request: { recipientIds: [recipient.id], page: input.placement.page },
				})
			: await addFields(input.documentId, {
					fields: input.placement.fields.map((field) => ({ ...field, recipientId: recipient.id })),
				});
	const activated = await activateSelfSignAfterFieldPreparation({
		envelopeId: input.documentId,
		sender: { name: recipient.name, email: input.principal.email },
		now: input.now,
	});
	if (!activated) throw new AgentSelfSignPreparationError("PREPARATION_BLOCKED");
	return fields;
}
