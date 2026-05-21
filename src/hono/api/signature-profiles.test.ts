import { envelopes, signatureProfiles } from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	signatureProfilesTable: null as unknown,
	envelopes: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			status: "draft",
			createdBy: "ada@example.com",
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
			sentBy: null,
			sentAt: null,
		},
	] as Array<Record<string, unknown>>,
	signatureProfiles: [] as Array<Record<string, unknown>>,
}));

function selectRows(table: unknown): Array<Record<string, unknown>> {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.signatureProfilesTable) return state.signatureProfiles;
	return [];
}

function insertRows(table: unknown, rows: Array<Record<string, unknown>>) {
	if (table !== state.signatureProfilesTable) return rows;
	const inserted = rows.map((row, index) => ({
		id: `60000000-0000-4000-8000-${String(state.signatureProfiles.length + index + 1).padStart(12, "0")}`,
		createdAt: new Date("2026-05-21T09:20:00.000Z"),
		...row,
	}));
	state.signatureProfiles.push(...inserted);
	return inserted;
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({
					limit: async () => selectRows(table),
				}),
			}),
		}),
		insert: (table: unknown) => ({
			values: (rows: Array<Record<string, unknown>> | Record<string, unknown>) => ({
				returning: async () => insertRows(table, Array.isArray(rows) ? rows : [rows]),
			}),
		}),
	}),
}));

describe("signature profile API", () => {
	beforeEach(() => {
		state.envelopesTable = envelopes;
		state.signatureProfilesTable = signatureProfiles;
		state.signatureProfiles.length = 0;
	});

	it("creates and selects a drawn signature profile with a renderable path", async () => {
		// Assumptions for issue #16 RED:
		// - Signature profiles are envelope-scoped and created before send.
		// - Drawn signatures persist an SVG path string as the renderable representation.
		// - selected=true marks the sender's chosen profile for this pilot slice.
		// - Uploaded signature images, initials, templates, partner verification, and final PDF rendering are out of scope.
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "ada@example.com",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					kind: "drawn",
					label: "Ada drawn",
					svgPath: "M 12 36 L 48 20 L 96 42",
					selected: true,
				}),
			},
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: {
				id: expect.any(String),
				envelopeId: "00000000-0000-4000-8000-000000000001",
				createdBy: "ada@example.com",
				kind: "drawn",
				label: "Ada drawn",
				svgPath: "M 12 36 L 48 20 L 96 42",
				typedText: null,
				typedFont: null,
				selected: true,
				createdAt: expect.any(String),
			},
		});
		expect(state.signatureProfiles).toEqual([
			expect.objectContaining({
				kind: "drawn",
				svgPath: "M 12 36 L 48 20 L 96 42",
				selected: true,
			}),
		]);
	});

	it("generates and selects a typed signature-like mark", async () => {
		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles",
			{
				method: "POST",
				headers: {
					"x-internal-user-id": "ada@example.com",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					kind: "typed",
					label: "Ada typed",
					typedText: "Ada Lovelace",
					typedFont: "cursive",
					selected: true,
				}),
			},
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			data: {
				id: expect.any(String),
				envelopeId: "00000000-0000-4000-8000-000000000001",
				createdBy: "ada@example.com",
				kind: "typed",
				label: "Ada typed",
				svgPath: null,
				typedText: "Ada Lovelace",
				typedFont: "cursive",
				selected: true,
				createdAt: expect.any(String),
			},
		});
	});
});
