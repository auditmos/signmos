import { eq } from "drizzle-orm";
import { envelopeRecipients, envelopes, finalDocuments } from "@/db/envelope";
import {
	deliverTransactionalEmail,
	type EmailDeliveryOptions,
	toAbsoluteDeliveryUrl,
} from "@/db/envelope/email-delivery";
import { getDb } from "@/db/setup";
import { historyAccessLinks, historyEmailRecords } from "./table";

const accessLinkTtlMs = 30 * 60 * 1000;

export interface HistoryAccessRequestResult {
	status: "accepted";
	accessUrl: string | null;
}

interface HistoryAccessRequestOptions {
	emailDelivery: EmailDeliveryOptions;
	now?: Date;
}

export async function requestHistoryAccess(
	email: string,
	options: HistoryAccessRequestOptions,
): Promise<HistoryAccessRequestResult> {
	const normalizedEmail = normalizeHistoryEmail(email);
	const matchingEnvelopeId = await findMatchingCompletedEnvelope(normalizedEmail);
	if (!matchingEnvelopeId) return { status: "accepted", accessUrl: null };

	const now = options.now ?? new Date();
	const rawCredential = crypto.randomUUID();
	const credentialHash = await hashHistoryCredential(rawCredential);
	const expiresAt = new Date(now.getTime() + accessLinkTtlMs);
	const db = getDb();
	const [link] = await db
		.insert(historyAccessLinks)
		.values({
			email: normalizedEmail,
			credentialHash,
			status: "pending",
			expiresAt,
		})
		.returning();
	if (!link) throw new Error("History access link was not created");

	const accessUrl = toAbsoluteDeliveryUrl(
		`/history-access/${rawCredential}`,
		options.emailDelivery,
	);
	await deliverTransactionalEmail(
		buildHistoryAccessEmail({ email: normalizedEmail, accessUrl }),
		options.emailDelivery,
	);
	await db
		.insert(historyEmailRecords)
		.values({
			linkId: link.id,
			email: normalizedEmail,
			kind: "history_access",
			deliveryStatus: "accepted",
		})
		.returning();
	await db
		.update(historyAccessLinks)
		.set({ status: "active", activatedAt: now })
		.where(eq(historyAccessLinks.id, link.id))
		.returning();

	return { status: "accepted", accessUrl };
}

export function buildHistoryAccessEmail(input: { email: string; accessUrl: string }) {
	return {
		to: input.email,
		subject: "Access your Signmos documents",
		text: `Open your secure My documents link:\n${input.accessUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email.`,
		html: `<p>Open your secure My documents link.</p><p><a href="${escapeHtml(input.accessUrl)}">View My documents</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request it, ignore this email.</p>`,
	};
}

export function normalizeHistoryEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function hashHistoryCredential(credential: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findMatchingCompletedEnvelope(email: string): Promise<string | null> {
	const db = getDb();
	const envelopeRows = await db.select().from(envelopes).limit(100);
	const completedEnvelopeIds = new Set(
		envelopeRows
			.filter((envelope) => envelope.status === "completed")
			.map((envelope) => envelope.id),
	);
	const recipientRows = await db
		.select()
		.from(envelopeRecipients)
		.where(eq(envelopeRecipients.email, email))
		.limit(100);
	const envelope = envelopeRows.find(
		(candidate) =>
			completedEnvelopeIds.has(candidate.id) &&
			(normalizeHistoryEmail(candidate.createdBy) === email ||
				recipientRows.some(
					(recipient) =>
						recipient.envelopeId === candidate.id &&
						normalizeHistoryEmail(recipient.email) === email,
				)),
	);
	if (!envelope) return null;
	const documents = await db
		.select()
		.from(finalDocuments)
		.where(eq(finalDocuments.envelopeId, envelope.id))
		.limit(1);
	return documents.length > 0 ? envelope.id : null;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
