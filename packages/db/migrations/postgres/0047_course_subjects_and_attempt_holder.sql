-- A commission is listed for a subject only when this link exists.
-- Commission names are unique per organization, ignoring case and surrounding spaces.
CREATE TABLE IF NOT EXISTS "course_subjects" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id"),
  "course_id" text NOT NULL REFERENCES "courses"("id"),
  "subject_id" text NOT NULL REFERENCES "subjects"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "course_subjects_pair_unique"
  ON "course_subjects" ("course_id", "subject_id");

-- Existing rows can repeat a name. Keep the oldest and suffix the rest
-- so the unique index can be created.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, lower(btrim(name))
           ORDER BY created_at, id
         ) AS n
  FROM courses
)
UPDATE courses AS c
SET name = c.name || ' ' || ranked.n
FROM ranked
WHERE c.id = ranked.id AND ranked.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_org_name_ci_unique"
  ON "courses" ("organization_id", lower(btrim("name")));

ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "holder_session_id" text;
