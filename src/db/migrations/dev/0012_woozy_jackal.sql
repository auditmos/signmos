CREATE TABLE "history_access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"credential_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_email_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"delivery_status" text NOT NULL,
	"provider_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"email" text NOT NULL,
	"session_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "history_email_records" ADD CONSTRAINT "history_email_records_link_id_history_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."history_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_sessions" ADD CONSTRAINT "history_sessions_link_id_history_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."history_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "history_access_links_credential_hash_unique" ON "history_access_links" USING btree ("credential_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "history_sessions_session_hash_unique" ON "history_sessions" USING btree ("session_hash");