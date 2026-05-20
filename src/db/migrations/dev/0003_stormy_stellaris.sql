CREATE TABLE "email_send_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"token_id" uuid NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "envelope_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signer_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signer_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "envelopes" ADD COLUMN "sent_by" text;--> statement-breakpoint
ALTER TABLE "envelopes" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_send_records" ADD CONSTRAINT "email_send_records_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_records" ADD CONSTRAINT "email_send_records_recipient_id_envelope_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."envelope_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_records" ADD CONSTRAINT "email_send_records_token_id_signer_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."signer_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envelope_recipients" ADD CONSTRAINT "envelope_recipients_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signer_tokens" ADD CONSTRAINT "signer_tokens_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signer_tokens" ADD CONSTRAINT "signer_tokens_recipient_id_envelope_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."envelope_recipients"("id") ON DELETE no action ON UPDATE no action;