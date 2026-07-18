import {
	addFields,
	addRecipients,
	createDefaultFieldPlacements,
	deleteRecipient,
	type EmailDeliveryOptions,
	type Envelope,
	type EnvelopeField,
	getEnvelopeAllowedActions,
	getLatestSourcePdfDocument,
	listEnvelopeFields,
	listRecipients,
	type Recipient,
	resendInvitation,
	sendEnvelope,
	updateRecipient,
} from "@/db/envelope";
import type { AgenticPrincipal } from "./bearer-principal";
import { getAuthorizedAgentCreatorEnvelope } from "./self-signing";

const recipientLimit = 10;

export class AgentRecipientMutationError extends Error {
	constructor(
		public readonly code:
			| "DOCUMENT_NOT_FOUND"
			| "NOT_TWO_PARTY"
			| "NOT_DRAFT"
			| "DUPLICATE_RECIPIENT"
			| "RECIPIENT_LIMIT_REACHED"
			| "RECIPIENT_NOT_FOUND"
			| "CREATOR_RECIPIENT_LOCKED",
	) {
		super(code);
		this.name = "AgentRecipientMutationError";
	}
}

export class AgentTwoPartyPreparationError extends Error {
	constructor(
		public readonly code:
			| "DOCUMENT_NOT_FOUND"
			| "NOT_DRAFT"
			| "SOURCE_REQUIRED"
			| "INVALID_RECIPIENT",
	) {
		super(code);
		this.name = "AgentTwoPartyPreparationError";
	}
}

export class AgentTwoPartyDeliveryError extends Error {
	constructor(
		public readonly code:
			| "DOCUMENT_NOT_FOUND"
			| "NOT_DRAFT"
			| "SOURCE_REQUIRED"
			| "PARTNER_REQUIRED"
			| "RECIPIENT_FIELDS_REQUIRED"
			| "CREATOR_SIGNING_REQUIRED"
			| "RESEND_NOT_ALLOWED"
			| "RECIPIENT_NOT_FOUND",
	) {
		super(code);
		this.name = "AgentTwoPartyDeliveryError";
	}
}

export interface AgentRecipientInput {
	name: string;
	email: string;
}

export async function listAgentCreatorRecipients(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<Recipient[] | null> {
	const envelope = await getAuthorizedAgentCreatorEnvelope(principal, documentId);
	if (!envelope || envelope.signingMode !== "me_and_another_signer") return null;
	return listRecipients(documentId);
}

export async function addAgentCreatorRecipients(input: {
	principal: AgenticPrincipal;
	documentId: string;
	recipients: AgentRecipientInput[];
}): Promise<Recipient[]> {
	await requireDraftTwoParty(input.principal, input.documentId);
	const existing = await listRecipients(input.documentId);
	const incomingEmails = input.recipients.map((recipient) => normalizeEmail(recipient.email));
	const existingEmails = new Set(existing.map((recipient) => normalizeEmail(recipient.email)));
	if (
		new Set(incomingEmails).size !== incomingEmails.length ||
		incomingEmails.some((email) => existingEmails.has(email))
	) {
		throw new AgentRecipientMutationError("DUPLICATE_RECIPIENT");
	}
	if (existing.length + input.recipients.length > recipientLimit) {
		throw new AgentRecipientMutationError("RECIPIENT_LIMIT_REACHED");
	}
	return addRecipients(input.documentId, {
		recipients: input.recipients.map((recipient) => ({
			name: recipient.name.trim(),
			email: normalizeEmail(recipient.email),
		})),
	});
}

export async function updateAgentCreatorRecipient(input: {
	principal: AgenticPrincipal;
	documentId: string;
	recipientId: string;
	recipient: AgentRecipientInput;
}): Promise<Recipient> {
	await requireDraftTwoParty(input.principal, input.documentId);
	const recipients = await listRecipients(input.documentId);
	const current = recipients.find((recipient) => recipient.id === input.recipientId);
	if (!current) throw new AgentRecipientMutationError("RECIPIENT_NOT_FOUND");
	if (sameEmail(current.email, input.principal.email)) {
		throw new AgentRecipientMutationError("CREATOR_RECIPIENT_LOCKED");
	}
	const nextEmail = normalizeEmail(input.recipient.email);
	if (
		recipients.some(
			(recipient) => recipient.id !== input.recipientId && sameEmail(recipient.email, nextEmail),
		)
	) {
		throw new AgentRecipientMutationError("DUPLICATE_RECIPIENT");
	}
	return updateRecipient(input.documentId, input.recipientId, {
		name: input.recipient.name.trim(),
		email: nextEmail,
	});
}

export async function deleteAgentCreatorRecipient(input: {
	principal: AgenticPrincipal;
	documentId: string;
	recipientId: string;
}): Promise<Recipient> {
	await requireDraftTwoParty(input.principal, input.documentId);
	const recipients = await listRecipients(input.documentId);
	const current = recipients.find((recipient) => recipient.id === input.recipientId);
	if (!current) throw new AgentRecipientMutationError("RECIPIENT_NOT_FOUND");
	if (sameEmail(current.email, input.principal.email)) {
		throw new AgentRecipientMutationError("CREATOR_RECIPIENT_LOCKED");
	}
	return deleteRecipient(input.documentId, input.recipientId);
}

export async function listAgentCreatorFields(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<EnvelopeField[] | null> {
	const envelope = await getAuthorizedAgentCreatorEnvelope(principal, documentId);
	if (!envelope || envelope.signingMode !== "me_and_another_signer") return null;
	return listEnvelopeFields(documentId);
}

export async function prepareAgentTwoPartyFields(input: {
	principal: AgenticPrincipal;
	documentId: string;
	placement:
		| { kind: "default"; page: number; recipientIds?: string[] }
		| {
				kind: "explicit";
				fields: Array<{
					recipientId?: string;
					type: "signature" | "date";
					page: number;
					x: number;
					y: number;
					width: number;
					height: number;
				}>;
		  };
}): Promise<EnvelopeField[]> {
	let envelope: Envelope;
	try {
		envelope = await requireDraftTwoParty(input.principal, input.documentId);
	} catch (error) {
		if (!(error instanceof AgentRecipientMutationError)) throw error;
		throw new AgentTwoPartyPreparationError(
			error.code === "NOT_DRAFT" ? "NOT_DRAFT" : "DOCUMENT_NOT_FOUND",
		);
	}
	if (!(await getLatestSourcePdfDocument(input.documentId))) {
		throw new AgentTwoPartyPreparationError("SOURCE_REQUIRED");
	}
	const recipients = await listRecipients(input.documentId);
	const recipientIds = new Set(recipients.map((recipient) => recipient.id));
	if (input.placement.kind === "default") {
		const requestedIds = input.placement.recipientIds ?? [];
		if (requestedIds.length === 0 || requestedIds.some((id) => !recipientIds.has(id))) {
			throw new AgentTwoPartyPreparationError("INVALID_RECIPIENT");
		}
		return createDefaultFieldPlacements({
			envelopeId: envelope.id,
			request: { recipientIds: requestedIds, page: input.placement.page },
		});
	}
	if (
		input.placement.fields.some(
			(field) => !field.recipientId || !recipientIds.has(field.recipientId),
		)
	) {
		throw new AgentTwoPartyPreparationError("INVALID_RECIPIENT");
	}
	return addFields(input.documentId, {
		fields: input.placement.fields.map((field) => ({
			...field,
			recipientId: field.recipientId ?? "",
		})),
	});
}

export async function sendAgentTwoPartyDocument(input: {
	principal: AgenticPrincipal;
	documentId: string;
	emailDelivery?: EmailDeliveryOptions;
}) {
	const envelope = await getAuthorizedAgentCreatorEnvelope(input.principal, input.documentId);
	if (!envelope || envelope.signingMode !== "me_and_another_signer") {
		throw new AgentTwoPartyDeliveryError("DOCUMENT_NOT_FOUND");
	}
	if (envelope.status !== "draft") throw new AgentTwoPartyDeliveryError("NOT_DRAFT");
	if (!(await getLatestSourcePdfDocument(input.documentId))) {
		throw new AgentTwoPartyDeliveryError("SOURCE_REQUIRED");
	}
	const recipients = await listRecipients(input.documentId);
	const creator = recipients.find((recipient) => sameEmail(recipient.email, input.principal.email));
	const partners = recipients.filter(
		(recipient) => !sameEmail(recipient.email, input.principal.email),
	);
	if (partners.length === 0) throw new AgentTwoPartyDeliveryError("PARTNER_REQUIRED");
	const fields = await listEnvelopeFields(input.documentId);
	const assignedRecipientIds = new Set(fields.map((field) => field.recipientId));
	if (recipients.some((recipient) => !assignedRecipientIds.has(recipient.id))) {
		throw new AgentTwoPartyDeliveryError("RECIPIENT_FIELDS_REQUIRED");
	}
	if (!creator || creator.status !== "completed") {
		throw new AgentTwoPartyDeliveryError("CREATOR_SIGNING_REQUIRED");
	}
	const result = await sendEnvelope(input.documentId, input.principal.email, {
		emailDelivery: input.emailDelivery,
	});
	return {
		documentId: result.envelopeId,
		status: result.status,
		sentBy: normalizeEmail(result.sentBy),
		invitedRecipients: partners.map((recipient) => ({ id: recipient.id, email: recipient.email })),
		emailSendCount: result.emailSendCount,
		allowedActions: getEnvelopeAllowedActions(result.status),
	};
}

export async function resendAgentTwoPartyInvitation(input: {
	principal: AgenticPrincipal;
	documentId: string;
	recipientId: string;
	emailDelivery?: EmailDeliveryOptions;
}) {
	const envelope = await getAuthorizedAgentCreatorEnvelope(input.principal, input.documentId);
	if (!envelope || envelope.signingMode !== "me_and_another_signer") {
		throw new AgentTwoPartyDeliveryError("DOCUMENT_NOT_FOUND");
	}
	if (envelope.status !== "sent") throw new AgentTwoPartyDeliveryError("RESEND_NOT_ALLOWED");
	const recipients = await listRecipients(input.documentId);
	const recipient = recipients.find((candidate) => candidate.id === input.recipientId);
	if (
		!recipient ||
		recipient.status !== "sent" ||
		sameEmail(recipient.email, input.principal.email)
	) {
		throw new AgentTwoPartyDeliveryError("RECIPIENT_NOT_FOUND");
	}
	const result = await resendInvitation(input.documentId, input.recipientId, {
		emailDelivery: input.emailDelivery,
	});
	return { documentId: input.documentId, ...result };
}

async function requireDraftTwoParty(
	principal: AgenticPrincipal,
	documentId: string,
): Promise<Envelope> {
	const envelope = await getAuthorizedAgentCreatorEnvelope(principal, documentId);
	if (!envelope) throw new AgentRecipientMutationError("DOCUMENT_NOT_FOUND");
	if (envelope.signingMode !== "me_and_another_signer") {
		throw new AgentRecipientMutationError("NOT_TWO_PARTY");
	}
	if (envelope.status !== "draft") throw new AgentRecipientMutationError("NOT_DRAFT");
	return envelope;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function sameEmail(left: string, right: string): boolean {
	return normalizeEmail(left) === normalizeEmail(right);
}
