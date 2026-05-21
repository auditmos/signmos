ALTER TABLE "email_send_records" ADD COLUMN "fallback_url" text;--> statement-breakpoint
ALTER TABLE "signer_tokens" ADD COLUMN "verified_at" timestamp with time zone;