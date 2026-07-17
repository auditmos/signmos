import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { hashAgenticCredential } from "./request";
import { appendAgenticSecurityEvent } from "./security-audit";
import { agenticApiTokens } from "./table";

export interface AgenticPrincipal {
	email: string;
	actorType: "agent";
	token: {
		id: string;
		name: string;
		hint: string;
		createdAt: Date;
		lastUsedAt: Date;
	};
}

export async function authenticateAgenticBearer(input: {
	authorization?: string;
	now?: Date;
	requestIp?: string;
}): Promise<AgenticPrincipal | null> {
	const rawToken = parseBearerToken(input.authorization);
	if (!rawToken) return null;
	const tokenHash = await hashAgenticCredential(rawToken);
	const db = getDb();
	const rows = await db
		.select()
		.from(agenticApiTokens)
		.where(and(eq(agenticApiTokens.tokenHash, tokenHash), eq(agenticApiTokens.status, "active")))
		.limit(1);
	const token = rows.find(
		(candidate) => candidate.tokenHash === tokenHash && candidate.status === "active",
	);
	if (!token) return null;
	const lastUsedAt = input.now ?? new Date();
	const updated = await db
		.update(agenticApiTokens)
		.set({ lastUsedAt })
		.where(and(eq(agenticApiTokens.id, token.id), eq(agenticApiTokens.status, "active")))
		.returning();
	if (updated.length === 0) return null;
	await appendAgenticSecurityEvent({
		tokenId: token.id,
		tokenName: token.name,
		email: token.email,
		eventType: "agentic.identity.read",
		actorType: "agent",
		requestIp: input.requestIp,
	});
	return {
		email: token.email,
		actorType: "agent",
		token: {
			id: token.id,
			name: token.name,
			hint: token.tokenHint,
			createdAt: token.createdAt,
			lastUsedAt,
		},
	};
}

function parseBearerToken(authorization: string | undefined): string | null {
	const match = /^Bearer (signmos_[A-Za-z0-9_-]{16,})$/.exec(authorization ?? "");
	return match?.[1] ?? null;
}
