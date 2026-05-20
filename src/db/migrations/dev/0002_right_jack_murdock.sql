CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_documents_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE no action ON UPDATE no action;