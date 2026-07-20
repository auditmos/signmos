import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const agenticAccessLinks = pgTable(
	"agentic_access_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		credentialHash: text("credential_hash").notNull(),
		status: text("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("agentic_access_links_credential_hash_unique").on(table.credentialHash)],
);

export const agenticAccessRequests = pgTable(
	"agentic_access_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		idempotencyKey: text("idempotency_key").notNull(),
		email: text("email").notNull(),
		linkId: uuid("link_id").references(() => agenticAccessLinks.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("agentic_access_requests_idempotency_key_unique").on(table.idempotencyKey),
	],
);

export const agenticEmailRecords = pgTable("agentic_email_records", {
	id: uuid("id").defaultRandom().primaryKey(),
	linkId: uuid("link_id")
		.notNull()
		.references(() => agenticAccessLinks.id),
	email: text("email").notNull(),
	kind: text("kind").notNull(),
	deliveryStatus: text("delivery_status").notNull(),
	providerMessage: text("provider_message"),
	sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agenticManagementSessions = pgTable(
	"agentic_management_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		linkId: uuid("link_id")
			.notNull()
			.references(() => agenticAccessLinks.id),
		email: text("email").notNull(),
		sessionHash: text("session_hash").notNull(),
		status: text("status").notNull().default("active"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("agentic_management_sessions_session_hash_unique").on(table.sessionHash)],
);

export const agenticApiTokens = pgTable(
	"agentic_api_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull(),
		tokenHint: text("token_hint").notNull(),
		status: text("status").notNull().default("active"),
		activeSlot: integer("active_slot"),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("agentic_api_tokens_token_hash_unique").on(table.tokenHash),
		uniqueIndex("agentic_api_tokens_email_active_slot_unique").on(table.email, table.activeSlot),
	],
);

export const agenticCommandRecords = pgTable(
	"agentic_command_records",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tokenId: uuid("token_id")
			.notNull()
			.references(() => agenticApiTokens.id),
		idempotencyKey: text("idempotency_key").notNull(),
		operation: text("operation").notNull(),
		requestFingerprint: text("request_fingerprint").notNull(),
		state: text("state").notNull().default("pending"),
		reviewId: uuid("review_id"),
		principalEmail: text("principal_email"),
		tokenName: text("token_name"),
		reviewerEmail: text("reviewer_email"),
		reviewerRole: text("reviewer_role"),
		reviewerRecipientId: uuid("reviewer_recipient_id"),
		reviewerFieldsSnapshot: text("reviewer_fields_snapshot"),
		reviewerFieldsDigest: text("reviewer_fields_digest"),
		documentTitle: text("document_title"),
		sourceDocumentId: uuid("source_document_id"),
		sourceVersion: integer("source_version"),
		sourceSha256: text("source_sha256"),
		actionPayload: text("action_payload"),
		actionPayloadDigest: text("action_payload_digest"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		decisionAt: timestamp("decision_at", { withTimezone: true }),
		terminalReason: text("terminal_reason"),
		notificationStatus: text("notification_status"),
		notificationProviderMessage: text("notification_provider_message"),
		decidedByEmail: text("decided_by_email"),
		decidedBySessionId: uuid("decided_by_session_id"),
		responseStatus: integer("response_status"),
		responseBody: text("response_body"),
		documentId: uuid("document_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("agentic_command_records_token_key_unique").on(table.tokenId, table.idempotencyKey),
		uniqueIndex("agentic_command_records_review_id_unique").on(table.reviewId),
	],
);

export const agenticSecurityEvents = pgTable("agentic_security_events", {
	id: uuid("id").defaultRandom().primaryKey(),
	linkId: uuid("link_id").references(() => agenticAccessLinks.id),
	sessionId: uuid("session_id").references(() => agenticManagementSessions.id),
	tokenId: uuid("token_id").references(() => agenticApiTokens.id),
	tokenName: text("token_name"),
	documentId: uuid("document_id"),
	email: text("email").notNull(),
	eventType: text("event_type").notNull(),
	actorType: text("actor_type").notNull(),
	requestIp: text("request_ip"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
