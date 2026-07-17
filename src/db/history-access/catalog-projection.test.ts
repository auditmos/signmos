import {
	auditEvents,
	envelopeRecipients,
	envelopes,
	senderVerificationTokens,
	sourceDocuments,
} from "@/db/envelope";
import { listHistoryDocuments } from "./catalog";
import { historySecurityEvents } from "./table";

type StoredRow = Record<string, unknown>;

const state = vi.hoisted(() => ({
	tables: new Map<string, unknown>(),
	envelopes: [] as StoredRow[],
	recipients: [] as StoredRow[],
	sources: [] as StoredRow[],
	senders: [] as StoredRow[],
	events: [] as StoredRow[],
	securityEvents: [] as StoredRow[],
	queriedTables: [] as unknown[],
}));

function rowsFor(table: unknown): StoredRow[] {
	state.queriedTables.push(table);
	if (table === state.tables.get("envelopes")) return state.envelopes;
	if (table === state.tables.get("recipients")) return state.recipients;
	if (table === state.tables.get("sources")) return state.sources;
	if (table === state.tables.get("senders")) return state.senders;
	if (table === state.tables.get("events")) return state.events;
	if (table === state.tables.get("securityEvents")) return state.securityEvents;
	return [];
}

vi.mock("@/db/setup", () => ({
	getDb: () => ({
		select: () => ({ from: async (table: unknown) => rowsFor(table) }),
	}),
}));

function id(sequence: number): string {
	return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function addEnvelope(input: {
	sequence: number;
	status: string;
	creator?: string;
	createdAt?: string;
}) {
	state.envelopes.push({
		id: id(input.sequence),
		status: input.status,
		signingMode: "me_and_another_signer",
		createdBy: input.creator ?? "owner@example.com",
		createdAt: new Date(input.createdAt ?? "2026-01-01T08:00:00.000Z"),
		sentBy: null,
		sentAt: null,
	});
}

function addRecipient(input: {
	sequence: number;
	envelope: number;
	email: string;
	name?: string;
	status?: string;
}) {
	state.recipients.push({
		id: id(1000 + input.sequence),
		envelopeId: id(input.envelope),
		name: input.name ?? `Signer ${input.sequence}`,
		email: input.email,
		status: input.status ?? "sent",
		createdAt: new Date("2026-01-01T08:00:00.000Z"),
	});
}

function addSource(input: { sequence: number; envelope: number; version: number; name: string }) {
	state.sources.push({
		id: id(2000 + input.sequence),
		envelopeId: id(input.envelope),
		r2Key: `envelopes/${id(input.envelope)}/source-v${input.version}.pdf`,
		version: input.version,
		sha256: "a".repeat(64),
		byteSize: 10,
		contentType: "application/pdf",
		originalFilename: input.name,
		uploadedBy: "owner@example.com",
		uploadedAt: new Date(`2026-01-0${input.version}T08:00:00.000Z`),
	});
}

describe("full history catalog projection", () => {
	beforeEach(() => {
		state.tables = new Map<string, unknown>([
			["envelopes", envelopes],
			["recipients", envelopeRecipients],
			["sources", sourceDocuments],
			["senders", senderVerificationTokens],
			["events", auditEvents],
			["securityEvents", historySecurityEvents],
		]);
		state.envelopes = [];
		state.recipients = [];
		state.sources = [];
		state.senders = [];
		state.events = [];
		state.securityEvents = [];
		state.queriedTables = [];
	});

	it("returns the complete authorized role/status matrix with latest titles and untitled drafts", async () => {
		// Issue #39 assumptions before RED:
		// - Authorization is normalized-email creator/recipient membership and precedes projection.
		// - Highest source revision supplies the title; no source produces the untitled fallback.
		// - Retention presence, not a second creation-date window, controls catalog membership.
		addEnvelope({
			sequence: 1,
			status: "awaiting_verification",
			createdAt: "2025-01-01T08:00:00.000Z",
		});
		addEnvelope({ sequence: 2, status: "draft", creator: "other@example.com" });
		addRecipient({ sequence: 2, envelope: 2, email: "owner@example.com" });
		addEnvelope({ sequence: 3, status: "sent" });
		addRecipient({ sequence: 3, envelope: 3, email: "OWNER@EXAMPLE.COM", status: "sent" });
		addRecipient({ sequence: 30, envelope: 3, email: "partner@example.com", name: "Grace Hopper" });
		addSource({ sequence: 31, envelope: 3, version: 1, name: "Old Contract.pdf" });
		addSource({ sequence: 32, envelope: 3, version: 2, name: "Latest Contract.pdf" });
		addEnvelope({ sequence: 4, status: "changes_requested" });
		addEnvelope({ sequence: 5, status: "completed", creator: "other@example.com" });
		addRecipient({ sequence: 5, envelope: 5, email: "owner@example.com", status: "completed" });
		addEnvelope({ sequence: 6, status: "declined" });
		addEnvelope({ sequence: 7, status: "expired", creator: "other@example.com" });
		addRecipient({ sequence: 7, envelope: 7, email: "owner@example.com" });
		addEnvelope({ sequence: 8, status: "completed", creator: "unrelated@example.com" });
		addEnvelope({ sequence: 9, status: "deleted" });
		state.senders.push({
			id: id(3001),
			envelopeId: id(3),
			name: "Ada Lovelace",
			email: "owner@example.com",
			token: "sender-token",
			status: "verified",
			expiresAt: new Date("2027-01-01T08:00:00.000Z"),
			verifiedAt: new Date("2026-01-01T08:00:00.000Z"),
			createdAt: new Date("2026-01-01T08:00:00.000Z"),
		});

		const result = await listHistoryDocuments({ email: " Owner@Example.COM ", page: 1 });

		expect(result.pagination).toEqual({ page: 1, pageSize: 25, totalItems: 7, totalPages: 1 });
		expect(result.items.map((item) => [item.envelopeId, item.status, item.role])).toEqual(
			expect.arrayContaining([
				[id(1), "awaiting_verification", "creator"],
				[id(2), "draft", "signer"],
				[id(3), "sent", "creator_and_signer"],
				[id(4), "changes_requested", "creator"],
				[id(5), "completed", "signer"],
				[id(6), "declined", "creator"],
				[id(7), "expired", "signer"],
			]),
		);
		const untitled = result.items.find((item) => item.envelopeId === id(1));
		expect(untitled).toMatchObject({
			title: "Untitled document",
			createdAt: "2025-01-01T08:00:00.000Z",
			shortReference: id(1).slice(0, 8),
		});
		const latest = result.items.find((item) => item.envelopeId === id(3));
		expect(latest).toMatchObject({
			title: "Latest Contract.pdf",
			group: "needs_my_action",
			allowedActions: ["sign", "review", "cancel", "delete"],
		});
		expect(latest?.participants).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "Ada Lovelace", email: "owner@example.com" }),
				expect.objectContaining({ name: "Grace Hopper", email: "partner@example.com" }),
			]),
		);
		expect(JSON.stringify(result)).not.toContain("Old Contract.pdf");
		expect(JSON.stringify(result)).not.toContain("unrelated@example.com");
		expect(result.items.some((item) => item.envelopeId === id(9))).toBe(false);
	});

	it("derives exact role-aware groups and action contracts", async () => {
		for (const [sequence, status, creator] of [
			[1, "awaiting_verification", "owner@example.com"],
			[2, "draft", "other@example.com"],
			[3, "changes_requested", "owner@example.com"],
			[4, "sent", "other@example.com"],
			[5, "completed", "owner@example.com"],
			[6, "declined", "owner@example.com"],
			[7, "expired", "owner@example.com"],
		] as const) {
			addEnvelope({ sequence, status, creator });
		}
		addRecipient({ sequence: 2, envelope: 2, email: "owner@example.com" });
		addRecipient({ sequence: 4, envelope: 4, email: "owner@example.com", status: "completed" });

		const result = await listHistoryDocuments({ email: "owner@example.com", page: 1 });
		const contract = Object.fromEntries(
			result.items.map((item) => [item.status, [item.group, item.allowedActions]]),
		);
		expect(contract).toEqual({
			awaiting_verification: ["drafts", ["resume"]],
			draft: ["waiting_on_others", []],
			changes_requested: ["needs_my_action", ["resume", "cancel", "delete"]],
			sent: ["waiting_on_others", []],
			completed: ["completed", ["view_completed", "download_final_pdf", "delete"]],
			declined: ["closed", []],
			expired: ["closed", ["delete"]],
		});
	});

	it("updates signer and creator perspectives as each recipient acts", async () => {
		addEnvelope({ sequence: 1, status: "sent", creator: "owner@example.com" });
		addRecipient({ sequence: 1, envelope: 1, email: "owner@example.com", status: "sent" });
		addRecipient({ sequence: 2, envelope: 1, email: "partner@example.com", status: "sent" });

		const needsAction = await listHistoryDocuments({ email: "owner@example.com", page: 1 });
		expect(needsAction.items[0]).toMatchObject({
			role: "creator_and_signer",
			group: "needs_my_action",
			allowedActions: ["sign", "review", "cancel", "delete"],
		});

		Object.assign(state.recipients[0] ?? {}, { status: "completed" });
		const waiting = await listHistoryDocuments({ email: "owner@example.com", page: 1 });
		expect(waiting.items[0]).toMatchObject({
			group: "waiting_on_others",
			allowedActions: ["review", "cancel", "delete"],
		});

		Object.assign(state.recipients[1] ?? {}, { status: "completed" });
		Object.assign(state.envelopes[0] ?? {}, { status: "completed" });
		const completed = await listHistoryDocuments({ email: "owner@example.com", page: 1 });
		expect(completed.items[0]).toMatchObject({ group: "completed" });
	});

	it("orders action work first, then meaningful activity, fallback creation, and identity", async () => {
		addEnvelope({ sequence: 1, status: "completed", createdAt: "2026-04-03T08:00:00.000Z" });
		addEnvelope({ sequence: 2, status: "completed", createdAt: "2026-04-01T08:00:00.000Z" });
		addEnvelope({
			sequence: 3,
			status: "changes_requested",
			createdAt: "2025-01-01T08:00:00.000Z",
		});
		addEnvelope({ sequence: 4, status: "completed", createdAt: "2026-04-01T08:00:00.000Z" });
		addEnvelope({ sequence: 5, status: "completed", createdAt: "2026-04-01T08:00:00.000Z" });
		state.events.push({
			id: id(4001),
			envelopeId: id(2),
			recipientId: null,
			eventType: "envelope.sent",
			message: null,
			createdAt: new Date("2026-05-01T08:00:00.000Z"),
		});
		state.securityEvents.push({
			id: id(5001),
			envelopeId: id(1),
			eventType: "history.document.opened",
			createdAt: new Date("2026-12-01T08:00:00.000Z"),
		});

		const result = await listHistoryDocuments({ email: "owner@example.com", page: 1 });

		expect(result.items.map((item) => item.envelopeId)).toEqual([
			id(3),
			id(2),
			id(1),
			id(4),
			id(5),
		]);
		expect(state.queriedTables).not.toContain(historySecurityEvents);
	});
});
