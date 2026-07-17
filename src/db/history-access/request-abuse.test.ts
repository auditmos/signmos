import { rateLimitRecords } from "@/db/envelope";
import { assertHistoryRequestRateLimits } from "./request-abuse";

const state = vi.hoisted(() => ({
	rateLimitTable: null as unknown,
	records: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({ limit: async () => (table === state.rateLimitTable ? state.records : []) }),
			}),
		}),
		insert: (table: unknown) => ({
			values: (row: Record<string, unknown>) => ({
				returning: async () => {
					if (table !== state.rateLimitTable) return [];
					const inserted = {
						id: `10000000-0000-4000-8000-${String(state.records.length + 1).padStart(12, "0")}`,
						createdAt: row.updatedAt,
						...row,
					};
					state.records.push(inserted);
					return [inserted];
				},
			}),
		}),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: async () => {
					if (table !== state.rateLimitTable) return [];
					const target = state.records.find(
						(candidate) => candidate.key === values.key && candidate.operation === values.operation,
					);
					if (target) Object.assign(target, values);
					return target ? [target] : [];
				},
			}),
		}),
	}),
}));

describe("history request dual-scope rate limits", () => {
	beforeEach(() => {
		state.rateLimitTable = rateLimitRecords;
		state.records = [];
	});

	it("accepts email requests 1-5, rejects 6, and accepts exactly at ten-minute reset", async () => {
		// Issue #38 assumptions before RED:
		// - Email identity is normalized before its rate key is formed.
		// - The active window is [start, reset), so reset itself begins a fresh window.
		// - Unique IPs isolate the normalized-email scope in this boundary test.
		const startedAt = new Date("2026-07-17T08:00:00.000Z");
		for (let attempt = 1; attempt <= 5; attempt += 1) {
			await expect(
				assertHistoryRequestRateLimits({
					email: " Owner@Example.COM ",
					requestIp: `203.0.113.${attempt}`,
					now: startedAt,
				}),
			).resolves.toBeUndefined();
		}

		await expect(
			assertHistoryRequestRateLimits({
				email: "owner@example.com",
				requestIp: "203.0.113.6",
				now: new Date("2026-07-17T08:09:59.999Z"),
			}),
		).rejects.toMatchObject({
			scope: "email",
			resetAt: new Date("2026-07-17T08:10:00.000Z"),
		});

		await expect(
			assertHistoryRequestRateLimits({
				email: "owner@example.com",
				requestIp: "203.0.113.7",
				now: new Date("2026-07-17T08:10:00.000Z"),
			}),
		).resolves.toBeUndefined();
	});

	it("accepts IP requests 1-5, rejects 6, and accepts exactly at ten-minute reset", async () => {
		const startedAt = new Date("2026-07-17T08:00:00.000Z");
		for (let attempt = 1; attempt <= 5; attempt += 1) {
			await expect(
				assertHistoryRequestRateLimits({
					email: `person-${attempt}@example.com`,
					requestIp: "198.51.100.9",
					now: startedAt,
				}),
			).resolves.toBeUndefined();
		}

		await expect(
			assertHistoryRequestRateLimits({
				email: "person-6@example.com",
				requestIp: "198.51.100.9",
				now: new Date("2026-07-17T08:09:59.999Z"),
			}),
		).rejects.toMatchObject({
			scope: "ip",
			resetAt: new Date("2026-07-17T08:10:00.000Z"),
		});

		await expect(
			assertHistoryRequestRateLimits({
				email: "person-7@example.com",
				requestIp: "198.51.100.9",
				now: new Date("2026-07-17T08:10:00.000Z"),
			}),
		).resolves.toBeUndefined();
	});
});
