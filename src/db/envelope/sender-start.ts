import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import {
	buildSenderVerificationEmail,
	deliverTransactionalEmail,
	type EmailDeliveryOptions,
	isResendConfigured,
} from "./email-delivery";
import {
	type Envelope,
	EnvelopeSchema,
	getEnvelopeAllowedActions,
	type SenderStartResponse,
	type SenderVerificationResponse,
	type SenderVerificationToken,
	SenderVerificationTokenSchema,
	type SigningMode,
} from "./schema";
import {
	auditEvents,
	envelopes,
	idempotencyRecords,
	rateLimitRecords,
	senderVerificationEmailRecords,
	senderVerificationTokens,
} from "./table";

const senderStartOperation = "sender.start";
const senderStartRateLimitOperation = "sender-start";
const senderStartMaxAttempts = 5;
const senderStartWindowMs = 10 * 60 * 1000;
const senderVerificationTtlMs = 30 * 60 * 1000;

export class SenderStartRateLimitError extends Error {
	constructor(
		public readonly scope: "ip" | "email",
		public readonly resetAt: Date,
	) {
		super("Sender start rate limit exceeded");
		this.name = "SenderStartRateLimitError";
	}
}

interface StartSenderEnvelopeInput {
	signingMode: SigningMode;
	name: string;
	email: string;
	requestIp: string;
	baseUrl: string;
	idempotencyKey?: string;
	now?: Date;
	emailDelivery?: EmailDeliveryOptions;
}

interface StartSenderEnvelopeResult {
	response: SenderStartResponse;
	reused: boolean;
}

type SenderVerificationResult =
	| { ok: true; data: SenderVerificationResponse }
	| {
			ok: false;
			error: {
				status: 404 | 410;
				code: "SENDER_VERIFICATION_NOT_FOUND" | "EXPIRED_SENDER_VERIFICATION";
				message: string;
			};
	  };

type RateLimitRecord = {
	id: string;
	key: string;
	operation: string;
	attempts: number;
	resetAt: Date;
};

export interface VerifiedSenderSession {
	envelopeId: string;
	signingMode: SigningMode;
	name: string;
	email: string;
	token: string;
}

export interface VerifiedSenderIdentity {
	envelopeId: string;
	name: string;
	email: string;
	token: string;
}

export async function startSenderEnvelope(
	input: StartSenderEnvelopeInput,
): Promise<StartSenderEnvelopeResult> {
	const now = input.now ?? new Date();
	const email = input.email.toLowerCase();
	const db = getDb();

	if (input.idempotencyKey) {
		const existing = await findIdempotentSenderStart({
			email,
			idempotencyKey: input.idempotencyKey,
			baseUrl: input.baseUrl,
		});
		if (existing) return { response: existing, reused: true };
	}

	await assertRateLimit({ key: `ip:${input.requestIp}`, scope: "ip", now });
	await assertRateLimit({ key: `email:${email}`, scope: "email", now });

	const [envelope] = await db
		.insert(envelopes)
		.values({
			createdBy: email,
			signingMode: input.signingMode,
			status: "awaiting_verification",
		})
		.returning();
	if (!envelope) throw new Error("Failed to create sender envelope");

	const tokenValue = crypto.randomUUID();
	const expiresAt = new Date(now.getTime() + senderVerificationTtlMs);
	const [verificationToken] = await db
		.insert(senderVerificationTokens)
		.values({
			envelopeId: envelope.id,
			name: input.name,
			email,
			token: tokenValue,
			status: "pending",
			expiresAt,
		})
		.returning();
	if (!verificationToken) throw new Error("Failed to create sender verification token");
	const token = SenderVerificationTokenSchema.parse(verificationToken);
	const fallbackUrl = buildSenderVerificationUrl(input.baseUrl, token.token);
	await deliverSenderVerificationEmail({
		email,
		name: input.name,
		fallbackUrl,
		emailDelivery: input.emailDelivery,
	});

	await db
		.insert(senderVerificationEmailRecords)
		.values({
			envelopeId: envelope.id,
			tokenId: token.id,
			email,
			kind: "sender_verification",
			fallbackUrl,
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
				eventType: "sender.verification.sent",
				message: email,
			},
		])
		.returning();

	if (input.idempotencyKey) {
		await db
			.insert(idempotencyRecords)
			.values({
				key: input.idempotencyKey,
				operation: senderStartOperation,
				createdBy: email,
				envelopeId: envelope.id,
			})
			.returning();
	}

	return {
		response: toSenderStartResponse({
			envelopeId: envelope.id,
			signingMode: input.signingMode,
			name: input.name,
			email,
			token,
			fallbackUrl,
		}),
		reused: false,
	};
}

export async function verifySenderToken(
	tokenValue: string,
	now = new Date(),
): Promise<SenderVerificationResult> {
	const db = getDb();
	const tokens = await db
		.select()
		.from(senderVerificationTokens)
		.where(eq(senderVerificationTokens.token, tokenValue))
		.limit(1);
	const row = tokens.find((candidate) => candidate.token === tokenValue);
	if (!row) {
		return {
			ok: false,
			error: {
				status: 404,
				code: "SENDER_VERIFICATION_NOT_FOUND",
				message: "Sender verification token was not found",
			},
		};
	}

	const token = SenderVerificationTokenSchema.parse(row);
	const signingMode = await getEnvelopeSigningMode(token.envelopeId);
	if (token.status !== "verified" && token.expiresAt <= now) {
		return {
			ok: false,
			error: {
				status: 410,
				code: "EXPIRED_SENDER_VERIFICATION",
				message: "Sender verification token has expired",
			},
		};
	}

	const verifiedAt = token.verifiedAt ?? now;
	if (token.status !== "verified") {
		await db
			.update(senderVerificationTokens)
			.set({ status: "verified", verifiedAt })
			.where(eq(senderVerificationTokens.id, token.id));
		await db.update(envelopes).set({ status: "draft" }).where(eq(envelopes.id, token.envelopeId));
		await db
			.insert(auditEvents)
			.values({
				envelopeId: token.envelopeId,
				recipientId: null,
				eventType: "sender.verified",
				message: token.email,
			})
			.returning();
	}

	return {
		ok: true,
		data: {
			envelopeId: token.envelopeId,
			status: "draft",
			signingMode,
			senderSessionToken: token.token,
			sender: {
				name: token.name,
				email: token.email,
			},
			allowedActions: getEnvelopeAllowedActions("draft"),
			verifiedAt: verifiedAt.toISOString(),
		},
	};
}

export async function resolveVerifiedSenderSession(
	tokenValue: string,
	envelopeId: string,
	_now = new Date(),
): Promise<VerifiedSenderSession | null> {
	const db = getDb();
	const tokens = await db
		.select()
		.from(senderVerificationTokens)
		.where(eq(senderVerificationTokens.token, tokenValue))
		.limit(10);
	const tokenRow = tokens.find((candidate) => candidate.token === tokenValue);
	if (!tokenRow) return null;
	const token = SenderVerificationTokenSchema.parse(tokenRow);
	if (token.status !== "verified" || token.envelopeId !== envelopeId) {
		return null;
	}

	return {
		envelopeId: token.envelopeId,
		signingMode: await getEnvelopeSigningMode(token.envelopeId),
		name: token.name,
		email: token.email,
		token: token.token,
	};
}

export async function resolveVerifiedSenderIdentity(
	tokenValue: string,
): Promise<VerifiedSenderIdentity | null> {
	const db = getDb();
	const tokens = await db
		.select()
		.from(senderVerificationTokens)
		.where(eq(senderVerificationTokens.token, tokenValue))
		.limit(10);
	const tokenRow = tokens.find((candidate) => candidate.token === tokenValue);
	if (!tokenRow) return null;
	const token = SenderVerificationTokenSchema.parse(tokenRow);
	if (token.status !== "verified") return null;

	return {
		envelopeId: token.envelopeId,
		name: token.name,
		email: token.email,
		token: token.token,
	};
}

async function findIdempotentSenderStart(input: {
	email: string;
	idempotencyKey: string;
	baseUrl: string;
}): Promise<SenderStartResponse | null> {
	const db = getDb();
	const records = await db
		.select()
		.from(idempotencyRecords)
		.where(
			and(
				eq(idempotencyRecords.key, input.idempotencyKey),
				eq(idempotencyRecords.operation, senderStartOperation),
				eq(idempotencyRecords.createdBy, input.email),
			),
		)
		.limit(10);
	const record = records.find(
		(candidate) =>
			candidate.key === input.idempotencyKey &&
			candidate.operation === senderStartOperation &&
			candidate.createdBy === input.email,
	);
	if (!record) return null;

	const tokens = await db
		.select()
		.from(senderVerificationTokens)
		.where(eq(senderVerificationTokens.envelopeId, record.envelopeId))
		.limit(10);
	const tokenRow = tokens.find((candidate) => candidate.envelopeId === record.envelopeId);
	if (!tokenRow) throw new Error("Idempotent sender verification result not found");
	const token = SenderVerificationTokenSchema.parse(tokenRow);

	return toSenderStartResponse({
		envelopeId: record.envelopeId,
		signingMode: await getEnvelopeSigningMode(record.envelopeId),
		name: token.name,
		email: token.email,
		token,
		fallbackUrl: buildSenderVerificationUrl(input.baseUrl, token.token),
	});
}

async function assertRateLimit(input: {
	key: string;
	scope: "ip" | "email";
	now: Date;
}): Promise<void> {
	const db = getDb();
	const rows = await db
		.select()
		.from(rateLimitRecords)
		.where(
			and(
				eq(rateLimitRecords.key, input.key),
				eq(rateLimitRecords.operation, senderStartRateLimitOperation),
			),
		)
		.limit(10);
	const record = rows.find(
		(candidate) =>
			candidate.key === input.key && candidate.operation === senderStartRateLimitOperation,
	) as RateLimitRecord | undefined;
	const resetAt = new Date(input.now.getTime() + senderStartWindowMs);
	if (!record) {
		await db
			.insert(rateLimitRecords)
			.values({
				key: input.key,
				operation: senderStartRateLimitOperation,
				attempts: 1,
				resetAt,
				updatedAt: input.now,
			})
			.returning();
		return;
	}

	const activeWindow = record.resetAt > input.now;
	if (activeWindow && record.attempts >= senderStartMaxAttempts) {
		throw new SenderStartRateLimitError(input.scope, record.resetAt);
	}

	await db
		.update(rateLimitRecords)
		.set({
			attempts: activeWindow ? record.attempts + 1 : 1,
			resetAt: activeWindow ? record.resetAt : resetAt,
			updatedAt: input.now,
		})
		.where(eq(rateLimitRecords.id, record.id));
}

function toSenderStartResponse(input: {
	envelopeId: Envelope["id"];
	signingMode: SigningMode;
	name: string;
	email: string;
	token: SenderVerificationToken;
	fallbackUrl: string;
}): SenderStartResponse {
	return {
		envelopeId: input.envelopeId,
		status: "awaiting_verification",
		signingMode: input.signingMode,
		sender: {
			name: input.name,
			email: input.email,
		},
		allowedActions: getEnvelopeAllowedActions("awaiting_verification"),
		verification: {
			email: input.email,
			expiresAt: input.token.expiresAt.toISOString(),
			fallbackUrl: input.fallbackUrl,
		},
	};
}

async function getEnvelopeSigningMode(envelopeId: string): Promise<SigningMode> {
	const db = getDb();
	const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
	return EnvelopeSchema.parse(envelope).signingMode;
}

function buildSenderVerificationUrl(baseUrl: string, token: string): string {
	return new URL(`/sender-verifications/${token}`, baseUrl).toString();
}

async function deliverSenderVerificationEmail(input: {
	email: string;
	name: string;
	fallbackUrl: string;
	emailDelivery: EmailDeliveryOptions | undefined;
}): Promise<void> {
	if (!input.emailDelivery || !isResendConfigured(input.emailDelivery.env)) return;
	await deliverTransactionalEmail(
		buildSenderVerificationEmail({
			email: input.email,
			senderName: input.name,
			verificationUrl: input.fallbackUrl,
		}),
		input.emailDelivery,
	);
}
