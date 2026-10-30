import type { TFunction } from "i18next";
import type { QuestionDTO } from "@exam/contracts";
import type { QuestionFormData } from "./QuestionForm";

export function emptyQuestionFormData(): QuestionFormData {
  return {
    type: "single_choice",
    content: "",
    contentDocument: null,
    answerMode: "plain",
    options: [
      { id: "A", content: "" },
      { id: "B", content: "" },
    ],
    standardAnswer: "",
    difficulty: 3,
    tags: [],
    gradingRule: {
      multiSelectScoring: "all_correct_full",
      fillBlankMatchMode: "exact",
      fillBlankCaseSensitive: false,
    },
    rubric: null,
  };
}

export function questionToFormData(q: QuestionDTO): QuestionFormData {
  return {
    type: q.type as QuestionFormData["type"],
    content: q.content,
    contentDocument: q.contentDocument ?? null,
    answerMode: q.answerMode ?? "plain",
    options: q.options,
    standardAnswer: q.standardAnswer,
    difficulty: q.difficulty,
    tags: q.tags,
    gradingRule: q.gradingRule as QuestionFormData["gradingRule"],
    rubric: q.rubric ?? null,
  };
}

export function validateQuestionForm(
  formData: QuestionFormData,
  t: TFunction,
): string | null {
  if (
    formData.type === "text_response" &&
    (formData.rubric == null || formData.rubric.trim() === "")
  ) {
    return t("admin.questionEdit.rubricRequired");
  }
  if (formData.type === "fill_blank" && !formData.content.includes("____")) {
    return t("admin.questionEdit.fillBlankPlaceholder");
  }
  return null;
}

export function buildQuestionPayload(formData: QuestionFormData) {
  const referenceAnswer =
    formData.type === "text_response" &&
    typeof formData.standardAnswer === "string" &&
    formData.standardAnswer.trim() !== ""
      ? formData.standardAnswer
      : null;
  const common = {
    type: formData.type,
    content: formData.content,
    contentDocument: formData.contentDocument ?? null,
    options:
      formData.type === "text_response"
        ? []
        : formData.options.map((o) =>
            o.contentDocument
              ? { ...o, contentDocument: o.contentDocument }
              : {
                  id: o.id,
                  content: o.content,
                  ...(o.isCorrect !== undefined
                    ? { isCorrect: o.isCorrect }
                    : {}),
                },
          ),
    difficulty: formData.difficulty,
    tags: formData.tags,
    gradingRule: formData.gradingRule,
    rubric: formData.type === "text_response" ? formData.rubric : null,
  };
  return formData.type === "text_response"
    ? {
        ...common,
        answerMode: formData.answerMode,
        standardAnswer: referenceAnswer,
      }
    : { ...common, standardAnswer: formData.standardAnswer };
}
