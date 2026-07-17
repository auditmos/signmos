import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const historyAccessLinks = pgTable(
	"history_access_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		credentialHash: text("credential_hash").notNull(),
		status: text("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("history_access_links_credential_hash_unique").on(table.credentialHash)],
);

export const historyAccessRequests = pgTable(
	"history_access_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		idempotencyKey: text("idempotency_key").notNull(),
		email: text("email").notNull(),
		linkId: uuid("link_id").references(() => historyAccessLinks.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("history_access_requests_idempotency_key_unique").on(table.idempotencyKey),
	],
);

export const historyEmailRecords = pgTable("history_email_records", {
	id: uuid("id").defaultRandom().primaryKey(),
	linkId: uuid("link_id")
		.notNull()
		.references(() => historyAccessLinks.id),
	email: text("email").notNull(),
	kind: text("kind").notNull(),
	deliveryStatus: text("delivery_status").notNull(),
	providerMessage: text("provider_message"),
	sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

export const historySessions = pgTable(
	"history_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		linkId: uuid("link_id")
			.notNull()
			.references(() => historyAccessLinks.id),
		email: text("email").notNull(),
		sessionHash: text("session_hash").notNull(),
		status: text("status").notNull().default("active"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("history_sessions_session_hash_unique").on(table.sessionHash)],
);

export const historySecurityEvents = pgTable("history_security_events", {
	id: uuid("id").defaultRandom().primaryKey(),
	linkId: uuid("link_id").references(() => historyAccessLinks.id),
	sessionId: uuid("session_id").references(() => historySessions.id),
	email: text("email").notNull(),
	eventType: text("event_type").notNull(),
	requestIp: text("request_ip"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
