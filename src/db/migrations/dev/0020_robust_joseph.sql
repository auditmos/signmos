CREATE TABLE "agentic_command_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"operation" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD CONSTRAINT "agentic_command_records_token_id_agentic_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."agentic_api_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_command_records_token_key_unique" ON "agentic_command_records" USING btree ("token_id","idempotency_key");