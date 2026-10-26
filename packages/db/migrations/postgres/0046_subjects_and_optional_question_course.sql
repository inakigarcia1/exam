-- Questions can exist without a commission. Exams can name a subject and
-- carry an inscription token from the moment they are created.
ALTER TABLE "questions" ALTER COLUMN "course_id" DROP NOT NULL;
ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_course_id_courses_id_fk";

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_org_name_unique"
  ON "subjects" ("organization_id", "name");

ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "subject_id" text REFERENCES "subjects"("id");
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "inscription_token" text;
CREATE UNIQUE INDEX IF NOT EXISTS "exams_inscription_token_unique"
  ON "exams" ("inscription_token");
UPDATE "exams"
  SET "inscription_token" = md5("id")
  WHERE "inscription_token" IS NULL;
