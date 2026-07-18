export interface EmailDeliveryEnv {
	APP_BASE_URL?: string;
	CLOUDFLARE_ENV?: string;
	EMAIL_DELIVERY_TEST_BYPASS?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
	RESEND_REPLY_TO_EMAIL?: string;
}

export interface EmailDeliveryOptions {
	env?: EmailDeliveryEnv;
	baseUrl: string;
	fetcher?: typeof fetch;
}

interface TransactionalEmail {
	to: string;
	subject: string;
	html: string;
	text: string;
}

interface PartnerVerificationEmailInput {
	email: string;
	recipientName: string;
	verificationUrl: string;
}

interface SenderVerificationEmailInput {
	email: string;
	senderName: string;
	verificationUrl: string;
}

interface SenderSigningEmailInput {
	email: string;
	senderName: string;
	signingUrl: string;
}

interface SenderPartnerSignedEmailInput {
	email: string;
	signerName: string;
	statusUrl: string;
}

interface SenderChangeRequestEmailInput {
	email: string;
	revisionUrl: string;
	comment: string;
}

interface ResendConfig {
	apiKey: string;
	fromEmail: string;
	replyToEmail: string;
}

export class EmailDeliveryError extends Error {
	constructor(
		public readonly status: number,
		public readonly responseText: string,
	) {
		super("Email provider rejected the message");
		this.name = "EmailDeliveryError";
	}
}

export function isResendConfigured(env: EmailDeliveryEnv | undefined): boolean {
	return getResendConfig(env) !== null;
}

export async function deliverTransactionalEmail(
	email: TransactionalEmail,
	options: EmailDeliveryOptions,
): Promise<void> {
	const config = getResendConfig(options.env);
	if (!config) return;

	const response = await (options.fetcher ?? fetch)("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${config.apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: config.fromEmail,
			to: [email.to],
			subject: email.subject,
			html: email.html,
			text: email.text,
			reply_to: config.replyToEmail,
		}),
	});

	if (!response.ok) {
		throw new EmailDeliveryError(response.status, await response.text());
	}
}

export function buildPartnerVerificationEmail(
	input: PartnerVerificationEmailInput,
): TransactionalEmail {
	const name = input.recipientName.trim() || "there";
	return {
		to: input.email,
		subject: "Verify your email to sign this document",
		text: `Hi ${name},\n\nVerify your email to review and sign this document:\n${input.verificationUrl}\n\nThis link expires in 7 days.`,
		html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your email to review and sign this document.</p><p><a href="${escapeHtml(input.verificationUrl)}">Open signing link</a></p><p>This link expires in 7 days.</p>`,
	};
}

export function buildSenderVerificationEmail(
	input: SenderVerificationEmailInput,
): TransactionalEmail {
	const name = input.senderName.trim() || "there";
	return {
		to: input.email,
		subject: "Verify your email to start signing",
		text: `Hi ${name},\n\nVerify your email to continue preparing your Signmos document:\n${input.verificationUrl}\n\nThis link expires in 30 minutes.`,
		html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your email to continue preparing your Signmos document.</p><p><a href="${escapeHtml(input.verificationUrl)}">Verify sender email</a></p><p>This link expires in 30 minutes.</p>`,
	};
}

export function buildSenderSigningEmail(input: SenderSigningEmailInput): TransactionalEmail {
	const name = input.senderName.trim() || "there";
	return {
		to: input.email,
		subject: "Sign your document",
		text: `Hi ${name},\n\nYour document is ready for your signature:\n${input.signingUrl}\n\nThis link expires in 7 days.`,
		html: `<p>Hi ${escapeHtml(name)},</p><p>Your document is ready for your signature.</p><p><a href="${escapeHtml(input.signingUrl)}">Open signing page</a></p><p>This link expires in 7 days.</p>`,
	};
}

export function buildSenderPartnerSignedEmail(
	input: SenderPartnerSignedEmailInput,
): TransactionalEmail {
	const signerName = input.signerName.trim() || "A signer";
	return {
		to: input.email,
		subject: "Your document was signed",
		text: `${signerName} signed your document.\n\nView document status:\n${input.statusUrl}`,
		html: `<p>${escapeHtml(signerName)} signed your document.</p><p><a href="${escapeHtml(input.statusUrl)}">View document status</a></p>`,
	};
}

export function buildSenderChangeRequestEmail(
	input: SenderChangeRequestEmailInput,
): TransactionalEmail {
	return {
		to: input.email,
		subject: "Changes requested on your document",
		text: `A signer requested changes before completing your document.\n\nComment:\n${input.comment}\n\nUpload a revised PDF here:\n${input.revisionUrl}`,
		html: `<p>A signer requested changes before completing your document.</p><p><strong>Comment:</strong></p><p>${escapeHtml(input.comment)}</p><p><a href="${escapeHtml(input.revisionUrl)}">Upload revised PDF</a></p>`,
	};
}

export function toAbsoluteDeliveryUrl(pathOrUrl: string, options: EmailDeliveryOptions): string {
	const baseUrl = (options.env?.APP_BASE_URL?.trim() || options.baseUrl).replace(/\/+$/, "");
	return new URL(pathOrUrl, baseUrl).toString();
}

function getResendConfig(env: EmailDeliveryEnv | undefined): ResendConfig | null {
	if (env?.CLOUDFLARE_ENV !== "production" && env?.EMAIL_DELIVERY_TEST_BYPASS === "true") {
		return null;
	}
	const apiKey = env?.RESEND_API_KEY?.trim();
	const fromEmail = env?.RESEND_FROM_EMAIL?.trim();
	const replyToEmail = env?.RESEND_REPLY_TO_EMAIL?.trim();
	if (!apiKey || !fromEmail || !replyToEmail) return null;
	return { apiKey, fromEmail, replyToEmail };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
