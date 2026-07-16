type SenderVerificationSuccess = {
	data: {
		envelopeId: string;
		sender: {
			name: string;
			email: string;
		};
	};
};

export type RecipientResponse = {
	id: string;
	envelopeId: string;
	name: string;
	email: string;
};

type RecipientsSuccess = { data: RecipientResponse[] };
type RecipientSuccess = { data: RecipientResponse };
type ApiError = { error: { message: string } };

export type RecipientFormValues = {
	senderName: string;
	senderEmail: string;
	partnerName: string;
	partnerEmail: string;
};

export type RecipientsResult = { recipients: RecipientResponse[]; prepareUrl: string };

export async function fetchVerifiedSender(
	senderSessionToken: string,
	envelopeId: string,
): Promise<SenderVerificationSuccess["data"]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/sender-session`, {
		headers: { "x-sender-session-token": senderSessionToken },
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isSenderVerificationSuccess(json) || json.data.envelopeId !== envelopeId) {
		throw new Error("Unable to load sender details");
	}
	return json.data;
}

export async function addRecipientPair(input: {
	envelopeId: string;
	senderSessionToken: string;
	existingRecipients: RecipientResponse[];
	senderName: string;
	senderEmail: string;
	partnerName: string;
	partnerEmail: string;
}): Promise<RecipientsResult> {
	const recipients = [
		...(findSenderRecipient(input.existingRecipients, input.senderEmail)
			? []
			: [{ name: input.senderName, email: input.senderEmail }]),
		{ name: input.partnerName, email: input.partnerEmail },
	];
	const response = await fetch(`/api/envelopes/${input.envelopeId}/recipients`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-sender-session-token": input.senderSessionToken,
		},
		body: JSON.stringify({ recipients }),
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isRecipientsSuccess(json)) {
		const message = isApiError(json) ? json.error.message : "Unable to add recipients";
		throw new Error(message);
	}
	const nextRecipients = orderRecipientsForPrepare(
		mergeRecipients(input.existingRecipients, json.data),
		input.senderEmail,
	);
	return {
		recipients: nextRecipients,
		prepareUrl: buildPrepareUrl(input.envelopeId, input.senderSessionToken, nextRecipients),
	};
}

export async function fetchRecipients(
	envelopeId: string,
	senderSessionToken: string,
): Promise<RecipientResponse[]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/recipients`, {
		headers: { "x-sender-session-token": senderSessionToken },
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isRecipientsSuccess(json)) {
		const message = isApiError(json) ? json.error.message : "Unable to load recipients";
		throw new Error(message);
	}
	return json.data;
}

export async function updateRecipientRequest(input: {
	envelopeId: string;
	senderSessionToken: string;
	recipientId: string;
	name: string;
	email: string;
}): Promise<RecipientResponse> {
	const response = await fetch(
		`/api/envelopes/${input.envelopeId}/recipients/${input.recipientId}`,
		{
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				"x-sender-session-token": input.senderSessionToken,
			},
			body: JSON.stringify({ name: input.name, email: input.email }),
		},
	);
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isRecipientSuccess(json)) {
		const message = isApiError(json) ? json.error.message : "Unable to update recipient";
		throw new Error(message);
	}
	return json.data;
}

export async function deleteRecipientRequest(input: {
	envelopeId: string;
	senderSessionToken: string;
	recipientId: string;
}): Promise<RecipientResponse> {
	const response = await fetch(
		`/api/envelopes/${input.envelopeId}/recipients/${input.recipientId}`,
		{
			method: "DELETE",
			headers: { "x-sender-session-token": input.senderSessionToken },
		},
	);
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isRecipientSuccess(json)) {
		const message = isApiError(json) ? json.error.message : "Unable to delete recipient";
		throw new Error(message);
	}
	return json.data;
}

export function buildPrepareUrl(
	envelopeId: string,
	senderSessionToken: string,
	recipients: RecipientResponse[],
): string {
	const [sender, partner] = recipients;
	if (!sender || !partner) return "/envelope-fields";
	const params = new URLSearchParams({
		envelopeId,
		recipientId: sender.id,
		name: sender.name,
		email: sender.email,
		partnerRecipientId: partner.id,
		partnerName: partner.name,
		partnerEmail: partner.email,
		senderSessionToken,
	});
	return `/envelope-fields?${params.toString()}`;
}

export function recipientsQueryKey(envelopeId: string, senderSessionToken: string) {
	return ["recipients", envelopeId, senderSessionToken] as const;
}

export function isRecipientActionDisabled({
	isSenderLoading,
	isSourcePdfLoading,
	isRecipientsLoading,
	sourcePdfReady,
	partnerRecipient,
	isEditingPartner,
}: {
	isSenderLoading: boolean;
	isSourcePdfLoading: boolean;
	isRecipientsLoading: boolean;
	sourcePdfReady: boolean;
	partnerRecipient: RecipientResponse | null;
	isEditingPartner: boolean;
}) {
	return (
		isSenderLoading ||
		isSourcePdfLoading ||
		isRecipientsLoading ||
		!sourcePdfReady ||
		Boolean(partnerRecipient && !isEditingPartner)
	);
}

export function findSenderRecipient(
	recipients: RecipientResponse[],
	senderEmail: string,
): RecipientResponse | null {
	const normalizedSenderEmail = normalizeEmail(senderEmail);
	return (
		recipients.find((recipient) => normalizeEmail(recipient.email) === normalizedSenderEmail) ??
		recipients[0] ??
		null
	);
}

function isSenderVerificationSuccess(value: unknown): value is SenderVerificationSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "sender" in data);
}

function isRecipientsSuccess(value: unknown): value is RecipientsSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	return Array.isArray(value.data);
}

function isRecipientSuccess(value: unknown): value is RecipientSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "id" in data);
}

function isApiError(value: unknown): value is ApiError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}

function orderRecipientsForPrepare(
	recipients: RecipientResponse[],
	senderEmail: string,
): RecipientResponse[] {
	const sender = findSenderRecipient(recipients, senderEmail);
	const partner = recipients.find((recipient) => recipient.id !== sender?.id);
	return sender && partner ? [sender, partner] : recipients;
}

function mergeRecipients(
	existingRecipients: RecipientResponse[],
	addedRecipients: RecipientResponse[],
): RecipientResponse[] {
	const recipients = new Map(existingRecipients.map((recipient) => [recipient.id, recipient]));
	for (const recipient of addedRecipients) recipients.set(recipient.id, recipient);
	return [...recipients.values()];
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
