import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { hashAgenticCredential, normalizeAgenticEmail } from "./request";
import { appendAgenticSecurityEvent } from "./security-audit";
import { agenticAccessLinks, agenticManagementSessions } from "./table";

const agenticManagementSessionTtlMs = 15 * 60 * 1000;

export async function createAgenticManagementSessionFromVerifiedIdentity(input: {
	email: string;
	now?: Date;
	requestIp?: string;
}): Promise<{ rawSession: string; expiresAt: Date }> {
	const db = getDb();
	const email = normalizeAgenticEmail(input.email);
	const now = input.now ?? new Date();
	const bridgeSeed = crypto.randomUUID();
	const [link] = await db
		.insert(agenticAccessLinks)
		.values({
			email,
			credentialHash: await hashAgenticCredential(bridgeSeed),
			status: "consumed",
			expiresAt: now,
			activatedAt: now,
			consumedAt: now,
		})
		.returning();
	if (!link) throw new Error("Agentic identity bridge was not created");

	const rawSession = crypto.randomUUID();
	const expiresAt = new Date(now.getTime() + agenticManagementSessionTtlMs);
	const [session] = await db
		.insert(agenticManagementSessions)
		.values({
			linkId: link.id,
			email,
			sessionHash: await hashAgenticCredential(rawSession),
			status: "active",
			expiresAt,
		})
		.returning();
	if (!session) throw new Error("Agentic management session was not created");
	await appendAgenticSecurityEvent({
		linkId: link.id,
		sessionId: session.id,
		email,
		eventType: "agentic.session.bridged",
		requestIp: input.requestIp,
	});
	return { rawSession, expiresAt };
}

export type AgenticLinkInspection =
	| { state: "confirm"; expiresAt: string }
	| { state: "unknown" | "consumed" | "expired" };

export async function inspectAgenticAccessLink(
	rawCredential: string,
	now = new Date(),
	requestIp?: string,
): Promise<AgenticLinkInspection> {
	const credentialHash = await hashAgenticCredential(rawCredential);
	const db = getDb();
	const rows = await db
		.select()
		.from(agenticAccessLinks)
		.where(eq(agenticAccessLinks.credentialHash, credentialHash))
		.limit(1);
	const link = rows.find((candidate) => candidate.credentialHash === credentialHash);
	if (!link) return { state: "unknown" };
	if (link.status === "consumed") return { state: "consumed" };
	if (link.status === "expired") return { state: "expired" };
	if (link.expiresAt <= now) {
		const expired = await db
			.update(agenticAccessLinks)
			.set({ status: "expired" })
			.where(and(eq(agenticAccessLinks.id, link.id), eq(agenticAccessLinks.status, "active")))
			.returning();
		if (expired.length > 0) {
			await appendAgenticSecurityEvent({
				linkId: link.id,
				email: link.email,
				eventType: "agentic.link.expired",
				requestIp,
			});
		}
		return { state: "expired" };
	}
	if (link.status !== "active") return { state: "unknown" };
	return { state: "confirm", expiresAt: link.expiresAt.toISOString() };
}

export type AgenticRedemptionResult =
	| { status: "authenticated"; rawSession: string; expiresAt: Date }
	| { status: "unknown" | "consumed" | "expired" };

export async function redeemAgenticAccessLink(
	rawCredential: string,
	now = new Date(),
	requestIp?: string,
): Promise<AgenticRedemptionResult> {
	const credentialHash = await hashAgenticCredential(rawCredential);
	const db = getDb();
	const consumed = await db
		.update(agenticAccessLinks)
		.set({ status: "consumed", consumedAt: now })
		.where(
			and(
				eq(agenticAccessLinks.credentialHash, credentialHash),
				eq(agenticAccessLinks.status, "active"),
				gt(agenticAccessLinks.expiresAt, now),
			),
		)
		.returning();
	const link = consumed.find((candidate) => candidate.credentialHash === credentialHash);
	if (!link) {
		const inspection = await inspectAgenticAccessLink(rawCredential, now, requestIp);
		return { status: inspection.state === "confirm" ? "unknown" : inspection.state };
	}

	const rawSession = crypto.randomUUID();
	const sessionHash = await hashAgenticCredential(rawSession);
	const expiresAt = new Date(now.getTime() + agenticManagementSessionTtlMs);
	const sessions = await db
		.insert(agenticManagementSessions)
		.values({
			linkId: link.id,
			email: link.email,
			sessionHash,
			status: "active",
			expiresAt,
		})
		.returning();
	const session = sessions[0];
	if (!session) throw new Error("Agentic management session was not created");
	await appendAgenticSecurityEvent({
		linkId: link.id,
		sessionId: session.id,
		email: link.email,
		eventType: "agentic.link.redeemed",
		requestIp,
	});
	return { status: "authenticated", rawSession, expiresAt };
}

export interface VerifiedAgenticManagementSession {
	id: string;
	email: string;
	expiresAt: Date;
}

export type AgenticManagementSessionState =
	| { state: "active"; session: VerifiedAgenticManagementSession }
	| { state: "missing" | "expired" };

export async function resolveAgenticManagementSession(
	rawSession: string,
	now = new Date(),
	requestIp?: string,
): Promise<AgenticManagementSessionState> {
	const sessionHash = await hashAgenticCredential(rawSession);
	const db = getDb();
	const rows = await db
		.select()
		.from(agenticManagementSessions)
		.where(eq(agenticManagementSessions.sessionHash, sessionHash))
		.limit(1);
	const session = rows.find((candidate) => candidate.sessionHash === sessionHash);
	if (!session || session.status !== "active") return { state: "missing" };
	if (session.expiresAt <= now) {
		const expired = await db
			.update(agenticManagementSessions)
			.set({ status: "expired" })
			.where(
				and(
					eq(agenticManagementSessions.id, session.id),
					eq(agenticManagementSessions.status, "active"),
				),
			)
			.returning();
		if (expired.length > 0) {
			await appendAgenticSecurityEvent({
				linkId: session.linkId,
				sessionId: session.id,
				email: session.email,
				eventType: "agentic.session.expired",
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
