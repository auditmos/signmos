ALTER TABLE "agentic_command_records" ADD COLUMN "review_id" uuid;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "principal_email" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "token_name" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "reviewer_email" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "reviewer_role" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "reviewer_recipient_id" uuid;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "source_document_id" uuid;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "source_version" integer;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "source_sha256" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "action_payload" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "action_payload_digest" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "decision_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "terminal_reason" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "notification_status" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "notification_provider_message" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "decided_by_email" text;--> statement-breakpoint
ALTER TABLE "agentic_command_records" ADD COLUMN "decided_by_session_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "agentic_command_records_review_id_unique" ON "agentic_command_records" USING btree ("review_id");