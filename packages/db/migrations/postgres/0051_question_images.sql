CREATE TABLE IF NOT EXISTS "question_images" (
	"organization_id" text NOT NULL REFERENCES "organizations"("id"),
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" bytea NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_images_pkey" PRIMARY KEY ("organization_id", "sha256"),
	CONSTRAINT "question_images_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "question_images_mime_type_check" CHECK ("mime_type" IN ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "question_images_size_check" CHECK ("size_bytes" = octet_length("bytes"))
);--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "questions" WHERE "attachments" IS NOT NULL AND "attachments" <> '[]'::jsonb) THEN
		RAISE EXCEPTION 'questions.attachments has non-empty rows; they cannot be mapped to question_images (ADR-024)';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN IF EXISTS "attachments";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "image" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "image_sha256" text GENERATED ALWAYS AS ("image" ->> 'sha256') STORED;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_image_fk" FOREIGN KEY ("organization_id", "image_sha256") REFERENCES "question_images"("organization_id", "sha256");
