import { and, eq } from "drizzle-orm";
import { rateLimitRecords } from "@/db/envelope";
import { getDb } from "@/db/setup";

const historyRequestRateLimitOperation = "history-access-request";
const historyRequestMaxAttempts = 5;
const historyRequestWindowMs = 10 * 60 * 1000;

type HistoryRequestRateScope = "ip" | "email";

type RateLimitRecord = {
	id: string;
	key: string;
	operation: string;
	attempts: number;
	resetAt: Date;
};

export class HistoryRequestRateLimitError extends Error {
	constructor(
		public readonly scope: HistoryRequestRateScope,
		public readonly resetAt: Date,
	) {
		super("History access request rate limit exceeded");
		this.name = "HistoryRequestRateLimitError";
	}
}

export async function assertHistoryRequestRateLimits(input: {
	email: string;
	requestIp: string;
	now: Date;
}): Promise<void> {
	await assertHistoryRequestRateLimit({
		key: `ip:${input.requestIp}`,
		scope: "ip",
		now: input.now,
	});
	await assertHistoryRequestRateLimit({
		key: `email:${input.email.trim().toLowerCase()}`,
		scope: "email",
		now: input.now,
	});
}

async function assertHistoryRequestRateLimit(input: {
	key: string;
	scope: HistoryRequestRateScope;
	now: Date;
}): Promise<void> {
	const db = getDb();
	const rows = await db
		.select()
		.from(rateLimitRecords)
		.where(
			and(
				eq(rateLimitRecords.key, input.key),
				eq(rateLimitRecords.operation, historyRequestRateLimitOperation),
			),
		)
		.limit(10);
	const record = rows.find(
		(candidate) =>
			candidate.key === input.key && candidate.operation === historyRequestRateLimitOperation,
	) as RateLimitRecord | undefined;
	const nextResetAt = new Date(input.now.getTime() + historyRequestWindowMs);
	if (!record) {
		await db
			.insert(rateLimitRecords)
			.values({
				key: input.key,
				operation: historyRequestRateLimitOperation,
				attempts: 1,
				resetAt: nextResetAt,
				updatedAt: input.now,
			})
			.returning();
		return;
	}

	const activeWindow = record.resetAt > input.now;
	if (activeWindow && record.attempts >= historyRequestMaxAttempts) {
		throw new HistoryRequestRateLimitError(input.scope, record.resetAt);
	}

	await db
		.update(rateLimitRecords)
		.set({
			key: input.key,
			operation: historyRequestRateLimitOperation,
			attempts: activeWindow ? record.attempts + 1 : 1,
			resetAt: activeWindow ? record.resetAt : nextResetAt,
			updatedAt: input.now,
		})
		.where(eq(rateLimitRecords.id, record.id));
}
