DROP INDEX IF EXISTS "questions_org_course_idx";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN IF EXISTS "course_id";
