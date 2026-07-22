import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { hashHistoryCredential, normalizeHistoryEmail } from "./request";
import { appendHistorySecurityEvent } from "./security-audit";
import { historyAccessLinks, historySessions } from "./table";

const historySessionTtlMs = 8 * 60 * 60 * 1000;

export async function createHistorySessionFromVerifiedIdentity(input: {
	email: string;
	verifiedUntil: Date;
	now?: Date;
	requestIp?: string;
}): Promise<{ rawSession: string; expiresAt: Date }> {
	const db = getDb();
	const email = normalizeHistoryEmail(input.email);
	const now = input.now ?? new Date();
	const expiresAt = new Date(
		Math.min(input.verifiedUntil.getTime(), now.getTime() + historySessionTtlMs),
	);
	if (expiresAt <= now) throw new Error("Verified identity already expired");

	const bridgeSeed = crypto.randomUUID();
	const [link] = await db
		.insert(historyAccessLinks)
		.values({
			email,
			credentialHash: await hashHistoryCredential(bridgeSeed),
			status: "consumed",
			expiresAt: now,
			activatedAt: now,
			consumedAt: now,
		})
		.returning();
	if (!link) throw new Error("History identity bridge was not created");

	const rawSession = crypto.randomUUID();
	const [session] = await db
		.insert(historySessions)
		.values({
			linkId: link.id,
			email,
			sessionHash: await hashHistoryCredential(rawSession),
			status: "active",
			expiresAt,
		})
		.returning();
	if (!session) throw new Error("History session was not created");
	await appendHistorySecurityEvent({
		linkId: link.id,
		sessionId: session.id,
		email,
		eventType: "history.session.bridged",
		requestIp: input.requestIp,
	});
	return { rawSession, expiresAt };
}

export type HistoryLinkInspection =
	| { state: "confirm"; expiresAt: string }
	| { state: "unknown" | "consumed" | "expired" | "revoked" };

export async function inspectHistoryAccessLink(
	rawCredential: string,
	now = new Date(),
	requestIp?: string,
): Promise<HistoryLinkInspection> {
	const credentialHash = await hashHistoryCredential(rawCredential);
	const db = getDb();
	const rows = await db
		.select()
		.from(historyAccessLinks)
		.where(eq(historyAccessLinks.credentialHash, credentialHash))
		.limit(1);
	const link = rows.find((candidate) => candidate.credentialHash === credentialHash);
	if (!link) return { state: "unknown" };
	if (link.status === "consumed") return { state: "consumed" };
	if (link.status === "revoked") return { state: "revoked" };
	if (link.status === "expired") return { state: "expired" };
	if (link.expiresAt <= now) {
		const expired = await db
			.update(historyAccessLinks)
			.set({ status: "expired" })
			.where(
				and(
					eq(historyAccessLinks.id, link.id),
					inArray(historyAccessLinks.status, ["pending", "active"]),
				),
			)
			.returning();
		if (expired.length > 0) {
			await appendHistorySecurityEvent({
				linkId: link.id,
				email: link.email,
				eventType: "history.link.expired",
				requestIp,
			});
		}
		return { state: "expired" };
	}
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
	requestIp?: string,
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
		const inspection = await inspectHistoryAccessLink(rawCredential, now, requestIp);
		return { status: inspection.state === "confirm" ? "unknown" : inspection.state };
	}

	const rawSession = crypto.randomUUID();
	const sessionHash = await hashHistoryCredential(rawSession);
	const expiresAt = new Date(now.getTime() + historySessionTtlMs);
	const [session] = await db
		.insert(historySessions)
		.values({
			linkId: link.id,
			email: link.email,
			sessionHash,
			status: "active",
			expiresAt,
		})
		.returning();
	if (!session) throw new Error("History session was not created");
	await appendHistorySecurityEvent({
		linkId: link.id,
		sessionId: session.id,
		email: link.email,
		eventType: "history.link.redeemed",
		requestIp,
	});
	return { status: "authenticated", rawSession, expiresAt };
}

export interface VerifiedHistorySession {
	id: string;
	email: string;
	expiresAt: Date;
}

export type HistorySessionState =
	| { state: "active"; session: VerifiedHistorySession }
	| { state: "missing" | "expired" | "revoked" };

export async function resolveHistorySessionState(
	rawSession: string,
	now = new Date(),
	requestIp?: string,
): Promise<HistorySessionState> {
	const sessionHash = await hashHistoryCredential(rawSession);
	const db = getDb();
	const rows = await db
		.select()
		.from(historySessions)
		.where(eq(historySessions.sessionHash, sessionHash))
		.limit(1);
	const session = rows.find((candidate) => candidate.sessionHash === sessionHash);
	if (!session) return { state: "missing" };
	if (session.status === "revoked") return { state: "revoked" };
	if (session.status === "expired") return { state: "expired" };
	if (session.status !== "active") return { state: "missing" };
	if (session.expiresAt <= now) {
		const expired = await db
			.update(historySessions)
			.set({ status: "expired" })
			.where(and(eq(historySessions.id, session.id), eq(historySessions.status, "active")))
			.returning();
		if (expired.length > 0) {
			await appendHistorySecurityEvent({
				linkId: session.linkId,
				sessionId: session.id,
				email: session.email,
				eventType: "history.session.expired",
				requestIp,
			});
		}
		return { state: "expired" };
	}
	return {
		state: "active",
		session: { id: session.id, email: session.email, expiresAt: session.expiresAt },
	};
}

export async function resolveHistorySession(
	rawSession: string,
	now = new Date(),
): Promise<VerifiedHistorySession | null> {
	const result = await resolveHistorySessionState(rawSession, now);
	return result.state === "active" ? result.session : null;
}

export async function revokeHistorySession(
	rawSession: string,
	now = new Date(),
	requestIp?: string,
): Promise<boolean> {
	const sessionHash = await hashHistoryCredential(rawSession);
	const db = getDb();
	const rows = await db
		.select()
		.from(historySessions)
		.where(eq(historySessions.sessionHash, sessionHash))
		.limit(1);
	const session = rows.find((candidate) => candidate.sessionHash === sessionHash);
	if (!session || session.status !== "active" || session.expiresAt <= now) return false;
	const revoked = await db
		.update(historySessions)
		.set({ status: "revoked", revokedAt: now })
		.where(and(eq(historySessions.id, session.id), eq(historySessions.status, "active")))
		.returning();
	if (revoked.length === 0) return false;
	await appendHistorySecurityEvent({
		linkId: session.linkId,
		sessionId: session.id,
		email: session.email,
		eventType: "history.session.revoked",
		requestIp,
	});
	return true;
}
