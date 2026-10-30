import { describe, expect, it } from "vitest";
import {
  buildQuestionPayload,
  emptyQuestionFormData,
  validateQuestionForm,
} from "./questionPayload";
import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;

describe("buildQuestionPayload", () => {
  it("does not include courseId", () => {
    const payload = buildQuestionPayload(emptyQuestionFormData());
    expect(payload).not.toHaveProperty("courseId");
  });

  it("normalizes empty text_response standardAnswer to null", () => {
    const payload = buildQuestionPayload({
      ...emptyQuestionFormData(),
      type: "text_response",
      standardAnswer: "   ",
      rubric: "Criterio",
      answerMode: "plain",
    });
    expect(payload.standardAnswer).toBeNull();
    expect(payload).toMatchObject({ answerMode: "plain" });
  });

  it("omits answerMode for non text_response types", () => {
    const payload = buildQuestionPayload({
      ...emptyQuestionFormData(),
      type: "single_choice",
      answerMode: "rich",
    });
    expect(payload).not.toHaveProperty("answerMode");
  });
});

describe("validateQuestionForm", () => {
  it("requires rubric for text_response", () => {
    const error = validateQuestionForm(
      {
        ...emptyQuestionFormData(),
        type: "text_response",
        rubric: "",
      },
      t,
    );
    expect(error).toBe("admin.questionEdit.rubricRequired");
  });

  it("requires fill_blank placeholder", () => {
    const error = validateQuestionForm(
      {
        ...emptyQuestionFormData(),
        type: "fill_blank",
        content: "Sin hueco",
      },
      t,
    );
    expect(error).toBe("admin.questionEdit.fillBlankPlaceholder");
  });
});
