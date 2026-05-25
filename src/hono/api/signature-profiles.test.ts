import { envelopes, senderVerificationTokens, signatureProfiles } from "@/db/envelope";
import { apiHono } from "@/hono/api";

const state = vi.hoisted(() => ({
	envelopesTable: null as unknown,
	senderVerificationTokensTable: null as unknown,
	signatureProfilesTable: null as unknown,
	envelopes: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			status: "draft",
			signingMode: "only_me",
			createdBy: "ada@example.com",
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
			sentBy: null,
			sentAt: null,
		},
	] as Array<Record<string, unknown>>,
	senderVerificationTokens: [] as Array<Record<string, unknown>>,
	signatureProfiles: [] as Array<Record<string, unknown>>,
}));

function selectRows(table: unknown, whereValue: string | null): Array<Record<string, unknown>> {
	if (table === state.envelopesTable) return state.envelopes;
	if (table === state.senderVerificationTokensTable) return state.senderVerificationTokens;
	if (table === state.signatureProfilesTable && whereValue) {
		return state.signatureProfiles.filter((profile) => profile.createdBy === whereValue);
	}
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
				where: (condition: unknown) => ({
					limit: async () => selectRows(table, stringParamFromEq(condition)),
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
		state.senderVerificationTokensTable = senderVerificationTokens;
		state.signatureProfilesTable = signatureProfiles;
		state.senderVerificationTokens.length = 0;
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

	it("returns the latest selected signature preference for the sender", async () => {
		state.signatureProfiles.push(
			{
				id: "60000000-0000-4000-8000-000000000001",
				envelopeId: "00000000-0000-4000-8000-000000000099",
				createdBy: "ada@example.com",
				kind: "drawn",
				label: "Old drawn",
				svgPath: "M 1 1 L 2 2",
				typedText: null,
				typedFont: null,
				selected: true,
				createdAt: new Date("2026-05-20T09:00:00.000Z"),
			},
			{
				id: "60000000-0000-4000-8000-000000000002",
				envelopeId: "00000000-0000-4000-8000-000000000098",
				createdBy: "ada@example.com",
				kind: "typed",
				label: "Ada typed",
				svgPath: null,
				typedText: "Ada Lovelace",
				typedFont: "cursive",
				selected: true,
				createdAt: new Date("2026-05-21T09:00:00.000Z"),
			},
			{
				id: "60000000-0000-4000-8000-000000000003",
				envelopeId: "00000000-0000-4000-8000-000000000097",
				createdBy: "other@example.com",
				kind: "typed",
				label: "Other typed",
				svgPath: null,
				typedText: "Other Person",
				typedFont: "serif",
				selected: true,
				createdAt: new Date("2026-05-22T09:00:00.000Z"),
			},
		);

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles/selected",
			{
				headers: {
					"x-internal-user-id": "ada@example.com",
				},
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: expect.objectContaining({
				id: "60000000-0000-4000-8000-000000000002",
				createdBy: "ada@example.com",
				kind: "typed",
				label: "Ada typed",
				typedText: "Ada Lovelace",
				typedFont: "cursive",
			}),
		});
	});

	it("resolves a saved signature profile for mixed-case variants of a verified email", async () => {
		// Assumptions for issue #31 RED:
		// - Saved signature identity is the normalized lowercase email.
		// - Sender-session access must be verified before saved content is returned.
		// - Latest selected signature profile is the user's preferred signature mode/content.
		// - Profile management screens and uploaded signature images are out of scope.
		state.senderVerificationTokens.push({
			id: "70000000-0000-4000-8000-000000000001",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Ada Lovelace",
			email: "ADA@Example.COM",
			token: "verified-sender-token",
			status: "verified",
			expiresAt: new Date("2026-05-28T09:00:00.000Z"),
			verifiedAt: new Date("2026-05-21T09:05:00.000Z"),
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
		});
		state.signatureProfiles.push({
			id: "60000000-0000-4000-8000-000000000004",
			envelopeId: "00000000-0000-4000-8000-000000000099",
			createdBy: "ada@example.com",
			kind: "typed",
			label: "Ada normalized typed",
			svgPath: null,
			typedText: "Ada Normalized",
			typedFont: "serif",
			selected: true,
			createdAt: new Date("2026-05-21T10:00:00.000Z"),
		});

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles/selected",
			{
				headers: {
					"x-sender-session-token": "verified-sender-token",
					"x-now": "2026-05-21T09:10:00.000Z",
				},
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: expect.objectContaining({
				id: "60000000-0000-4000-8000-000000000004",
				createdBy: "ada@example.com",
				kind: "typed",
				typedText: "Ada Normalized",
			}),
		});
	});

	it("does not return saved signature content for an unverified sender session", async () => {
		state.senderVerificationTokens.push({
			id: "70000000-0000-4000-8000-000000000002",
			envelopeId: "00000000-0000-4000-8000-000000000001",
			name: "Ada Lovelace",
			email: "ada@example.com",
			token: "pending-sender-token",
			status: "pending",
			expiresAt: new Date("2026-05-28T09:00:00.000Z"),
			verifiedAt: null,
			createdAt: new Date("2026-05-21T09:00:00.000Z"),
		});
		state.signatureProfiles.push({
			id: "60000000-0000-4000-8000-000000000005",
			envelopeId: "00000000-0000-4000-8000-000000000099",
			createdBy: "ada@example.com",
			kind: "drawn",
			label: "Private drawn",
			svgPath: "M 1 1 L 2 2",
			typedText: null,
			typedFont: null,
			selected: true,
			createdAt: new Date("2026-05-21T10:00:00.000Z"),
		});

		const response = await apiHono.request(
			"/api/envelopes/00000000-0000-4000-8000-000000000001/signature-profiles/selected",
			{
				headers: {
					"x-sender-session-token": "pending-sender-token",
					"x-now": "2026-05-21T09:10:00.000Z",
				},
			},
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "UNAUTHORIZED",
				message: "Missing x-internal-user-id header",
			},
		});
	});
});

function stringParamFromEq(condition: unknown): string | null {
	if (!hasQueryChunks(condition)) return null;
	for (const chunk of condition.queryChunks) {
		if (hasStringValue(chunk)) return chunk.value;
	}
	return null;
}

function hasQueryChunks(value: unknown): value is { queryChunks: unknown[] } {
	return Boolean(
		value &&
			typeof value === "object" &&
			"queryChunks" in value &&
			Array.isArray(value.queryChunks),
	);
}

function hasStringValue(value: unknown): value is { value: string } {
	return Boolean(
		value && typeof value === "object" && "value" in value && typeof value.value === "string",
	);
}
