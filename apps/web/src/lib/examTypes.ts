import type { CandidateTakeQuestion } from "@exam/contracts";
import type { LoadAttemptResponse } from "@exam/contracts";

/** A single question snapshot item as received by candidates during an exam attempt. */
export type CandidateQuestionSnapshot =
  LoadAttemptResponse["questionSnapshot"][number];

/** Maps a take/preview question DTO to the shape expected by QuestionRenderer. */
export function takeQuestionToRendererSnapshot(
  q: CandidateTakeQuestion,
  order: number,
): CandidateQuestionSnapshot {
  return {
    originalQuestionId: q.id,
    type: q.type,
    content: q.prompt,
    contentDocument: q.promptDocument,
    answerMode: q.answerMode,
    attachments: [],
    options: q.options,
    score: q.maxScore,
    order,
  };
}
