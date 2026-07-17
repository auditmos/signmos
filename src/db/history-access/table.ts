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
