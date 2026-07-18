import { and, eq } from "drizzle-orm";
import { rateLimitRecords } from "@/db/envelope";
import { getDb } from "@/db/setup";
import { agentApiRateLimitPolicy } from "./agent-rate-limit-policy";

export { agentApiRateLimitPolicy } from "./agent-rate-limit-policy";

export const agentApiRateLimitOperation = "agent-api-v1";

type AgentRateLimitScope = "token" | "ip";

interface AgentRateLimitRecord {
	id: string;
	key: string;
	operation: string;
	attempts: number;
	resetAt: Date;
}

export interface AgentRateLimitState {
	scope: AgentRateLimitScope;
	limit: number;
	remaining: number;
	resetAt: Date;
}

export class AgentApiRateLimitError extends Error {
	constructor(readonly state: AgentRateLimitState) {
		super("Agent API rate limit exceeded");
		this.name = "AgentApiRateLimitError";
	}
}

export async function consumeAgentApiRateLimits(input: {
	tokenId: string;
	requestIp?: string;
	now: Date;
}): Promise<AgentRateLimitState> {
	const states = [
		await consumeFixedWindow({
			key: `token:${input.tokenId}`,
			scope: "token",
			limit: agentApiRateLimitPolicy.token.limit,
			now: input.now,
		}),
	];
	if (input.requestIp) {
		states.push(
			await consumeFixedWindow({
				key: `ip:${input.requestIp}`,
				scope: "ip",
				limit: agentApiRateLimitPolicy.ip.limit,
				now: input.now,
			}),
		);
	}
	return states.sort(
		(left, right) => left.remaining / left.limit - right.remaining / right.limit,
	)[0] as AgentRateLimitState;
}

export function agentRateLimitHeaders(state: AgentRateLimitState, now: Date) {
	return {
		"RateLimit-Limit": String(state.limit),
		"RateLimit-Remaining": String(state.remaining),
		"RateLimit-Reset": String(Math.ceil(state.resetAt.getTime() / 1_000)),
		"Retry-After": String(retryAfterSeconds(state, now)),
	};
}

function retryAfterSeconds(state: AgentRateLimitState, now: Date): number {
	return Math.max(1, Math.ceil((state.resetAt.getTime() - now.getTime()) / 1_000));
}

async function consumeFixedWindow(input: {
	key: string;
	scope: AgentRateLimitScope;
	limit: number;
	now: Date;
}): Promise<AgentRateLimitState> {
	const db = getDb();
	const selected = await db
		.select()
		.from(rateLimitRecords)
		.where(
			and(
				eq(rateLimitRecords.key, input.key),
				eq(rateLimitRecords.operation, agentApiRateLimitOperation),
			),
		)
		.limit(1);
	const record = selected.find(
		(candidate) =>
			candidate.key === input.key && candidate.operation === agentApiRateLimitOperation,
	) as AgentRateLimitRecord | undefined;
	const nextResetAt = new Date(input.now.getTime() + agentApiRateLimitPolicy.windowSeconds * 1_000);
	if (!record) {
		await db
			.insert(rateLimitRecords)
			.values({
				key: input.key,
				operation: agentApiRateLimitOperation,
				attempts: 1,
				resetAt: nextResetAt,
				updatedAt: input.now,
			})
			.returning();
		return state(input, 1, nextResetAt);
	}

	const activeWindow = record.resetAt > input.now;
	if (activeWindow && record.attempts >= input.limit) {
		throw new AgentApiRateLimitError(state(input, record.attempts, record.resetAt));
	}
	const attempts = activeWindow ? record.attempts + 1 : 1;
	const resetAt = activeWindow ? record.resetAt : nextResetAt;
	await db
		.update(rateLimitRecords)
		.set({ attempts, resetAt, updatedAt: input.now })
		.where(eq(rateLimitRecords.id, record.id));
	return state(input, attempts, resetAt);
}

function state(
	input: { scope: AgentRateLimitScope; limit: number },
	attempts: number,
	resetAt: Date,
): AgentRateLimitState {
	return {
		scope: input.scope,
		limit: input.limit,
		remaining: Math.max(0, input.limit - attempts),
		resetAt,
	};
}
