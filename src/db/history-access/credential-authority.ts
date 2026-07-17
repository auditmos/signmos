import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { hashHistoryCredential } from "./request";
import { historyAccessLinks, historySessions } from "./table";

const historySessionTtlMs = 8 * 60 * 60 * 1000;

export type HistoryLinkInspection =
	| { state: "confirm"; expiresAt: string }
	| { state: "unknown" | "consumed" | "expired" | "revoked" };

export async function inspectHistoryAccessLink(
	rawCredential: string,
	now = new Date(),
): Promise<HistoryLinkInspection> {
	const credentialHash = await hashHistoryCredential(rawCredential);
	const rows = await getDb()
		.select()
		.from(historyAccessLinks)
		.where(eq(historyAccessLinks.credentialHash, credentialHash))
		.limit(1);
	const link = rows.find((candidate) => candidate.credentialHash === credentialHash);
	if (!link) return { state: "unknown" };
	if (link.status === "consumed") return { state: "consumed" };
	if (link.status === "revoked") return { state: "revoked" };
	if (link.expiresAt <= now) return { state: "expired" };
	if (link.status !== "active") return { state: "unknown" };
	return { state: "confirm", expiresAt: link.expiresAt.toISOString() };
}

export type HistoryRedemptionResult =
	| {
			status: "authenticated";
			rawSession: string;
			expiresAt: Date;
	  }
	| { status: "unknown" | "consumed" | "expired" | "revoked" };

export async function redeemHistoryAccessLink(
	rawCredential: string,
	now = new Date(),
): Promise<HistoryRedemptionResult> {
	const db = getDb();
	const credentialHash = await hashHistoryCredential(rawCredential);
	const consumedLinks = await db
		.update(historyAccessLinks)
		.set({ status: "consumed", consumedAt: now })
		.where(
			and(
				eq(historyAccessLinks.credentialHash, credentialHash),
				eq(historyAccessLinks.status, "active"),
				gt(historyAccessLinks.expiresAt, now),
			),
		)
		.returning();
	const link = consumedLinks.find((candidate) => candidate.credentialHash === credentialHash);
	if (!link) {
		const inspection = await inspectHistoryAccessLink(rawCredential, now);
		return { status: inspection.state === "confirm" ? "unknown" : inspection.state };
	}

	const rawSession = crypto.randomUUID();
	const sessionHash = await hashHistoryCredential(rawSession);
	const expiresAt = new Date(now.getTime() + historySessionTtlMs);
	await db
		.insert(historySessions)
		.values({
			linkId: link.id,
			email: link.email,
			sessionHash,
			status: "active",
			expiresAt,
		})
		.returning();
	return { status: "authenticated", rawSession, expiresAt };
}

export interface VerifiedHistorySession {
	id: string;
	email: string;
	expiresAt: Date;
}

export async function resolveHistorySession(
	rawSession: string,
	now = new Date(),
): Promise<VerifiedHistorySession | null> {
	const sessionHash = await hashHistoryCredential(rawSession);
	const rows = await getDb()
		.select()
		.from(historySessions)
		.where(eq(historySessions.sessionHash, sessionHash))
		.limit(1);
	const session = rows.find((candidate) => candidate.sessionHash === sessionHash);
	if (!session || session.status !== "active" || session.expiresAt <= now) return null;
	return { id: session.id, email: session.email, expiresAt: session.expiresAt };
}
