import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const envelopeStatuses = ["draft", "sent", "completed", "declined", "expired"] as const;

export const envelopes = pgTable("envelopes", {
	id: uuid("id").defaultRandom().primaryKey(),
	status: text("status").notNull().default("draft"),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const idempotencyRecords = pgTable(
	"idempotency_records",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		key: text("key").notNull(),
		operation: text("operation").notNull(),
		createdBy: text("created_by").notNull(),
		envelopeId: uuid("envelope_id")
			.notNull()
			.references(() => envelopes.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idempotency_records_key_operation_created_by_unique").on(
			table.key,
			table.operation,
			table.createdBy,
		),
	],
);

export const sourceDocuments = pgTable("source_documents", {
	id: uuid("id").defaultRandom().primaryKey(),
	envelopeId: uuid("envelope_id")
		.notNull()
		.references(() => envelopes.id),
	r2Key: text("r2_key").notNull().unique(),
	sha256: text("sha256").notNull(),
	byteSize: integer("byte_size").notNull(),
	contentType: text("content_type").notNull(),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});
