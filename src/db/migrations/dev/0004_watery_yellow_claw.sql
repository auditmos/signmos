CREATE TABLE "envelope_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"page" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "envelope_fields" ADD CONSTRAINT "envelope_fields_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envelope_fields" ADD CONSTRAINT "envelope_fields_recipient_id_envelope_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."envelope_recipients"("id") ON DELETE no action ON UPDATE no action;