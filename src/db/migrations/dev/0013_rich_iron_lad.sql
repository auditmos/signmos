CREATE TABLE "history_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"email" text NOT NULL,
	"link_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid,
	"session_id" uuid,
	"email" text NOT NULL,
	"event_type" text NOT NULL,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "history_access_requests" ADD CONSTRAINT "history_access_requests_link_id_history_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."history_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_security_events" ADD CONSTRAINT "history_security_events_link_id_history_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."history_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_security_events" ADD CONSTRAINT "history_security_events_session_id_history_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."history_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "history_access_requests_idempotency_key_unique" ON "history_access_requests" USING btree ("idempotency_key");