import {
	envelopes as envelopesTable,
	idempotencyRecords as idempotencyRecordsTable,
} from "@/db/envelope";
import { apiHono } from "@/hono/api";

const dbState = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	idempotencyRecordsTable: null as unknown,
	insertedEnvelopes: [] as Array<{
		id: string;
		status: "draft";
		createdBy: string;
		createdAt: Date;
	}>,
	idempotencyRecords: [] as Array<{
		key: string;
		operation: string;
		createdBy: string;
		envelopeId: string;
	}>,
}));

const insertedEnvelopes = dbState.insertedEnvelopes;

type InsertedEnvelope = {
	id: string;
	status: "draft";
	createdBy: string;
	createdAt: Date;
};

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({
					limit: async () => {
						if (table === dbState.idempotencyRecordsTable) {
							return dbState.idempotencyRecords;
						}
						if (table === dbState.envelopesTable) {
							const record = dbState.idempotencyRecords[0];
							return dbState.insertedEnvelopes.filter(
								(envelope) => envelope.id === record?.envelopeId,
							);
						}
						return [];
					},
				}),
			}),
		}),
		insert: (table: unknown) => ({
			values: (value: Partial<InsertedEnvelope> & { envelopeId?: string; key?: string }) => ({
				returning: async () => {
					if (table === dbState.idempotencyRecordsTable) {
						dbState.idempotencyRecords.push({
							key: value.key ?? "",
							operation: "envelope.create",
							createdBy: value.createdBy ?? "",
							envelopeId: value.envelopeId ?? "",
						});
						return [];
					}

					const row = {
						id: `00000000-0000-4000-8000-${String(dbState.insertedEnvelopes.length + 1).padStart(12, "0")}`,
						status: "draft" as const,
						createdBy: value.createdBy ?? "",
						createdAt: new Date("2026-05-20T07:00:00.000Z"),
					};
					dbState.insertedEnvelopes.push(row);
					return [row];
				},
			}),
		}),
	}),
}));

describe("envelopes API", () => {
	beforeEach(() => {
		dbState.envelopesTable = envelopesTable;
		dbState.idempotencyRecordsTable = idempotencyRecordsTable;
		dbState.insertedEnvelopes.length = 0;
		dbState.idempotencyRecords.length = 0;
	});

	it("creates an authenticated draft envelope with stable JSON", async () => {
		// Assumptions for issue #6 RED:
		// - Minimal internal auth is carried by x-internal-user-id until a fuller auth layer exists.
		// - Draft creation returns { data } with id, status, createdBy, and createdAt.
		// - PDF upload, recipients, fields, signing, emails, and final PDFs are intentionally out of scope.
		const response = await apiHono.request("/api/envelopes", {
			method: "POST",
			headers: {
				"x-internal-user-id": "user_123",
				"idempotency-key": "create-envelope-1",
			},
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toEqual({
			data: {
				id: expect.any(String),
				status: "draft",
				createdBy: "user_123",
				createdAt: expect.any(String),
			},
		});
		expect(insertedEnvelopes).toHaveLength(1);
		expect(insertedEnvelopes[0]?.createdBy).toBe("user_123");
		expect(insertedEnvelopes[0]?.createdAt).toBeInstanceOf(Date);
	});

	it("returns the original draft envelope for a repeated idempotency key", async () => {
		const request = {
			method: "POST",
			headers: {
				"x-internal-user-id": "user_123",
				"idempotency-key": "create-envelope-1",
			},
		};

		const first = await apiHono.request("/api/envelopes", request);
		const second = await apiHono.request("/api/envelopes", request);

		expect(first.status).toBe(201);
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(await first.json());
		expect(insertedEnvelopes).toHaveLength(1);
	});

	it("returns machine-readable valid values for invalid lifecycle actions", async () => {
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/actions",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "user_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({ action: "archive" }),
			},
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "INVALID_ACTION",
				message: "Invalid envelope lifecycle action",
				validValues: ["send"],
			},
		});
	});
});
