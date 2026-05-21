CREATE TABLE "signature_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"svg_path" text,
	"typed_text" text,
	"typed_font" text,
	"selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signature_profiles" ADD CONSTRAINT "signature_profiles_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;