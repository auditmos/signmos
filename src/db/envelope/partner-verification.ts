import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { RecipientSchema, type SignerToken, SignerTokenSchema } from "./schema";
import { auditEvents, envelopeRecipients, signerTokens } from "./table";

export type PartnerVerificationResult =
	| {
			ok: true;
			data: {
				envelopeId: string;
				recipientId: string;
				status: "verified";
				signingLink: {
					token: string;
					url: string;
				};
				verifiedAt: string;
			};
	  }
	| {
			ok: false;
			error: {
				status: 404 | 410;
				code: "PARTNER_VERIFICATION_NOT_FOUND" | "EXPIRED_PARTNER_VERIFICATION";
				message: string;
			};
	  };

export async function verifyPartnerToken(
	tokenValue: string,
	now = new Date(),
): Promise<PartnerVerificationResult> {
	const db = getDb();
	const tokens = await db
		.select()
		.from(signerTokens)
		.where(eq(signerTokens.token, tokenValue))
		.limit(1);
	const row = tokens.find((candidate) => candidate.token === tokenValue);
	if (!row) {
		return {
			ok: false,
			error: {
				status: 404,
				code: "PARTNER_VERIFICATION_NOT_FOUND",
				message: "Partner verification token was not found",
			},
		};
	}

	const token = SignerTokenSchema.parse(row);
	if (token.status !== "active") {
		return {
			ok: false,
			error: {
				status: 404,
				code: "PARTNER_VERIFICATION_NOT_FOUND",
				message: "Partner verification token was not found",
			},
		};
	}
	if (token.expiresAt <= now) {
		await recordPartnerLinkExpired(token);
		return {
			ok: false,
			error: {
				status: 410,
				code: "EXPIRED_PARTNER_VERIFICATION",
				message: "Partner verification token has expired",
			},
		};
	}

	const verifiedAt = token.verifiedAt ?? now;
	if (!token.verifiedAt) {
		await db.update(signerTokens).set({ verifiedAt }).where(eq(signerTokens.id, token.id));
		await db
			.insert(auditEvents)
			.values({
				envelopeId: token.envelopeId,
				recipientId: token.recipientId,
				eventType: "partner.verified",
				message: await getRecipientEmail(token),
			})
			.returning();
	}

	return {
		ok: true,
		data: {
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			status: "verified",
			signingLink: {
				token: token.token,
				url: `/signing/${token.token}`,
			},
			verifiedAt: verifiedAt.toISOString(),
		},
	};
}

export async function recordPartnerLinkExpired(token: SignerToken): Promise<void> {
	const db = getDb();
	await db
		.insert(auditEvents)
		.values({
			envelopeId: token.envelopeId,
			recipientId: token.recipientId,
			eventType: "partner.link.expired",
			message: token.token,
		})
		.returning();
}

async function getRecipientEmail(token: SignerToken): Promise<string> {
	const db = getDb();
	const recipients = await db
		.select()
		.from(envelopeRecipients)
		.where(eq(envelopeRecipients.id, token.recipientId))
		.limit(1);
	const row = recipients[0];
	return row ? RecipientSchema.parse(row).email : "";
}
