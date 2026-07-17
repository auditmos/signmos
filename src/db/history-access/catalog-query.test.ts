import {
	auditEvents,
	envelopeRecipients,
	envelopes,
	senderVerificationTokens,
	sourceDocuments,
} from "@/db/envelope";
import { authorizeHistoryDocument, listHistoryDocuments } from "./catalog";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	rows: new Map<unknown, StoredRow[]>(),
}));

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({ from: async (table: unknown) => state.rows.get(table) ?? [] }),
	}),
}));

function id(sequence: number): string {
	return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function rows(table: unknown): StoredRow[] {
	const existing = state.rows.get(table) ?? [];
	state.rows.set(table, existing);
	return existing;
}

function addEnvelope(input: {
	sequence: number;
	creator?: string;
	creatorName?: string;
	status?: string;
	createdAt?: Date;
}) {
	rows(envelopes).push({
		id: id(input.sequence),
		status: input.status ?? "completed",
		signingMode: "me_and_another_signer",
		createdBy: input.creator ?? "owner@example.com",
		createdByName: input.creatorName ?? null,
		createdAt: input.createdAt ?? new Date("2026-01-01T08:00:00.000Z"),
		sentBy: null,
		sentAt: null,
	});
}

function addRecipient(input: {
	sequence: number;
	envelope: number;
	email: string;
	name: string;
	status?: string;
}) {
	rows(envelopeRecipients).push({
		id: id(1000 + input.sequence),
		envelopeId: id(input.envelope),
		name: input.name,
		email: input.email,
		status: input.status ?? "sent",
		createdAt: new Date("2026-01-01T08:00:00.000Z"),
	});
}

function addSource(sequence: number, name: string) {
	rows(sourceDocuments).push({
		id: id(2000 + sequence),
		envelopeId: id(sequence),
		r2Key: `envelopes/${id(sequence)}/source-v1.pdf`,
		version: 1,
		sha256: "a".repeat(64),
		byteSize: 10,
		contentType: "application/pdf",
		originalFilename: name,
		uploadedBy: "owner@example.com",
		uploadedAt: new Date("2026-01-02T08:00:00.000Z"),
	});
}

describe("history catalog authorized query", () => {
	beforeEach(() => {
		state.rows = new Map<unknown, StoredRow[]>([
			[envelopes, []],
			[envelopeRecipients, []],
			[sourceDocuments, []],
			[senderVerificationTokens, []],
			[auditEvents, []],
		]);
	});

	it.each([
		"quarterly",
		"GRACE HOPPER",
		"grace@example.com",
	])("searches authorized filename and participant data for %s", async (search) => {
		addEnvelope({ sequence: 1 });
		addSource(1, "Quarterly Agreement.PDF");
		addRecipient({
			sequence: 1,
			envelope: 1,
			email: "grace@example.com",
			name: "Grace Hopper",
			status: "completed",
		});
		addEnvelope({ sequence: 2, creator: "unrelated@example.com" });
		addSource(2, "Secret Match.pdf");
		addRecipient({
			sequence: 2,
			envelope: 2,
			email: "secret@example.com",
			name: "Secret Match",
		});

		const result = await listHistoryDocuments({
			email: "owner@example.com",
			page: 1,
			search,
		});

		expect(result.items.map((item) => item.envelopeId)).toEqual([id(1)]);
		expect(JSON.stringify(result)).not.toContain("secret@example.com");
	});

	it("does not match search text found only in an unauthorized envelope", async () => {
		addEnvelope({ sequence: 1, creator: "unrelated@example.com" });
		addSource(1, "Confidential Needle.pdf");

		const result = await listHistoryDocuments({
			email: "owner@example.com",
			page: 1,
			search: "needle",
		});

		expect(result.items).toEqual([]);
		expect(result.pagination.totalItems).toBe(0);
	});

	it("suggests the newest name for the exact session email independently of filters", async () => {
		// Approved prefill assumptions before RED:
		// - The exact normalized session email selects a name; aliases remain distinct.
		// - Most recent means the authorized document with the newest meaningful activity.
		// - The suggestion is advisory/editable and does not change with search or pagination.
		addEnvelope({
			sequence: 1,
			creatorName: "Older Creator Name",
			createdAt: new Date("2026-01-01T08:00:00.000Z"),
		});
		addEnvelope({
			sequence: 2,
			creator: "someone-else@example.com",
			createdAt: new Date("2026-01-03T08:00:00.000Z"),
		});
		addRecipient({
			sequence: 2,
			envelope: 2,
			email: "OWNER@example.com",
			name: "Newest Signer Name",
		});

		const result = await listHistoryDocuments({
			email: " owner@EXAMPLE.com ",
			page: 1,
			search: "no matching document",
		});

		expect(result.items).toEqual([]);
		expect(result.identity).toEqual({
			email: "owner@example.com",
			suggestedName: "Newest Signer Name",
		});
	});

	it("combines role, group, and exact-status filters after authorization", async () => {
		addEnvelope({ sequence: 1, status: "changes_requested" });
		addEnvelope({ sequence: 2, status: "sent", creator: "other@example.com" });
		addRecipient({
			sequence: 2,
			envelope: 2,
			email: "owner@example.com",
			name: "Owner",
			status: "sent",
		});
		addEnvelope({ sequence: 3, status: "sent", creator: "unrelated@example.com" });

		const result = await listHistoryDocuments({
			email: "owner@example.com",
			page: 1,
			role: "signer",
			group: "needs_my_action",
			status: "sent",
		});

		expect(result.items.map((item) => item.envelopeId)).toEqual([id(2)]);
	});

	it("returns stable non-overlapping 25-row pages with every row reachable", async () => {
		for (let sequence = 1; sequence <= 52; sequence += 1) addEnvelope({ sequence });
		const pages = await Promise.all(
			[1, 2, 3].map((page) => listHistoryDocuments({ email: "owner@example.com", page })),
		);
		const ids = pages.flatMap((page) => page.items.map((item) => item.envelopeId));

		expect(pages.map((page) => page.items.length)).toEqual([25, 25, 2]);
		expect(pages[0]?.pagination).toEqual({
			page: 1,
			pageSize: 25,
			totalItems: 52,
			totalPages: 3,
		});
		expect(new Set(ids).size).toBe(52);
	});

	it("does not truncate results beyond the legacy 500-row candidate limit", async () => {
		for (let sequence = 1; sequence <= 525; sequence += 1) addEnvelope({ sequence });
		const pages = await Promise.all(
			Array.from({ length: 21 }, (_, index) =>
				listHistoryDocuments({ email: "owner@example.com", page: index + 1 }),
			),
		);
		const ids = pages.flatMap((page) => page.items.map((item) => item.envelopeId));

		expect(pages[0]?.pagination.totalItems).toBe(525);
		expect(ids).toHaveLength(525);
		expect(new Set(ids).size).toBe(525);
	});

	it("omits a newly deleted row and rejects its fresh direct authorization", async () => {
		addEnvelope({ sequence: 1 });
		const first = await listHistoryDocuments({ email: "owner@example.com", page: 1 });
		expect(first.items.map((item) => item.envelopeId)).toEqual([id(1)]);

		const envelope = rows(envelopes)[0];
		if (envelope) envelope.status = "deleted";
		const refreshed = await listHistoryDocuments({ email: "owner@example.com", page: 1 });

		expect(refreshed.items).toEqual([]);
		await expect(authorizeHistoryDocument("owner@example.com", id(1))).resolves.toBeNull();
	});
});
