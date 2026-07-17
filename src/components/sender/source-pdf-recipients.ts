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
	historyAccess = false,
): Promise<SenderVerificationSuccess["data"]> {
	const response = await fetch(
		historyAccess
			? `/api/history/documents/${envelopeId}/creator`
			: `/api/envelopes/${envelopeId}/sender-session`,
		historyAccess
			? { credentials: "same-origin" }
			: { headers: { "x-sender-session-token": senderSessionToken } },
	);
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
	historyAccess?: boolean;
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
			...senderAccessHeader(input.senderSessionToken, input.historyAccess),
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
		prepareUrl: buildPrepareUrl(
			input.envelopeId,
			input.senderSessionToken,
			nextRecipients,
			input.historyAccess,
		),
	};
}

export async function fetchRecipients(
	envelopeId: string,
	senderSessionToken: string,
	historyAccess = false,
): Promise<RecipientResponse[]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/recipients`, {
		headers: senderAccessHeader(senderSessionToken, historyAccess),
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
	historyAccess?: boolean;
}): Promise<RecipientResponse> {
	const response = await fetch(
		`/api/envelopes/${input.envelopeId}/recipients/${input.recipientId}`,
		{
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				...senderAccessHeader(input.senderSessionToken, input.historyAccess),
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
	historyAccess?: boolean;
}): Promise<RecipientResponse> {
	const response = await fetch(
		`/api/envelopes/${input.envelopeId}/recipients/${input.recipientId}`,
		{
			method: "DELETE",
			headers: senderAccessHeader(input.senderSessionToken, input.historyAccess),
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
	historyAccess = false,
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
	});
	if (historyAccess) params.set("historyAccess", "true");
	else params.set("senderSessionToken", senderSessionToken);
	return `/envelope-fields?${params.toString()}`;
}

export function recipientsQueryKey(
	envelopeId: string,
	senderSessionToken: string,
	historyAccess = false,
) {
	return ["recipients", envelopeId, historyAccess ? "history" : senderSessionToken] as const;
}

export function hasSenderDetails(name: string, email: string) {
	return Boolean(name && email);
}

export function shouldFetchVerifiedSender(
	senderSessionToken: string,
	hasSenderProps: boolean,
	historyAccess = false,
) {
	return Boolean(senderSessionToken || historyAccess) && !hasSenderProps;
}

export function shouldFetchRecipients(
	envelopeId: string,
	senderSessionToken: string,
	sourcePdfReady: boolean,
	historyAccess = false,
) {
	return Boolean(envelopeId && (senderSessionToken || historyAccess) && sourcePdfReady);
}

function senderAccessHeader(
	senderSessionToken: string,
	historyAccess = false,
): Record<string, string> {
	return historyAccess
		? { "x-history-session-access": "true" }
		: { "x-sender-session-token": senderSessionToken };
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
