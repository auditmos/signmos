CREATE TABLE "agentic_access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"credential_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"email" text NOT NULL,
	"link_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic_email_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"delivery_status" text NOT NULL,
	"provider_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic_management_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"email" text NOT NULL,
	"session_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid,
	"session_id" uuid,
	"token_id" uuid,
	"token_name" text,
	"email" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentic_access_requests" ADD CONSTRAINT "agentic_access_requests_link_id_agentic_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."agentic_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_email_records" ADD CONSTRAINT "agentic_email_records_link_id_agentic_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."agentic_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_management_sessions" ADD CONSTRAINT "agentic_management_sessions_link_id_agentic_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."agentic_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_security_events" ADD CONSTRAINT "agentic_security_events_link_id_agentic_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."agentic_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_security_events" ADD CONSTRAINT "agentic_security_events_session_id_agentic_management_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agentic_management_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_security_events" ADD CONSTRAINT "agentic_security_events_token_id_agentic_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."agentic_api_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_access_links_credential_hash_unique" ON "agentic_access_links" USING btree ("credential_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_access_requests_idempotency_key_unique" ON "agentic_access_requests" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_api_tokens_token_hash_unique" ON "agentic_api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_management_sessions_session_hash_unique" ON "agentic_management_sessions" USING btree ("session_hash");