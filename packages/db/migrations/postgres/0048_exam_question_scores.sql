-- Points belong to a question inside an exam, not to the question bank.
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "question_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE "exams" AS e
SET "question_scores" = COALESCE(
  (
    SELECT jsonb_object_agg(q.id, to_jsonb(q.score))
    FROM jsonb_array_elements_text(e.question_ids) AS qid(id)
    JOIN "questions" AS q ON q.id = qid.id
  ),
  '{}'::jsonb
)
WHERE e.status = 'draft';

ALTER TABLE "questions" DROP COLUMN IF EXISTS "score";

ALTER TABLE "exam_policy_profiles"
  ADD COLUMN IF NOT EXISTS "restrict_simultaneous_access" boolean NOT NULL DEFAULT false;
