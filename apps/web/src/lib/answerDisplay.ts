import { resolveRichAnswerDocument } from "@exam/contracts";
import i18n from "@/i18n";

/** Formats a stored answer into plain text for review surfaces. */
export function formatAnswerForDisplay(
  value: unknown,
  answerMode?: string | null,
): string {
  if (value === undefined || value === null || value === "") {
    return i18n.t("candidateResult.answer.unanswered");
  }
  const richDocument = resolveRichAnswerDocument(value, answerMode);
  if (richDocument) {
    return i18n.t("content.unsupportedAnswer" as never);
  }
  if (answerMode === "rich") {
    return i18n.t("content.unsupportedAnswer" as never);
  }
  if (typeof value === "string") {
    return value.includes("|")
      ? value
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" o ")
      : value;
  }
  if (typeof value === "boolean") {
    return value
      ? i18n.t("candidateResult.answer.correct")
      : i18n.t("candidateResult.answer.incorrect");
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((part) => formatAnswerForDisplay(part, answerMode))
      .join(", ");
  }
  return String(value);
}

/** Formats the frozen reference answer for teacher review. */
export function formatStandardAnswerForDisplay(
  value: unknown,
  questionType: string,
): string {
  if (value == null || value === "") {
    return questionType === "text_response"
      ? i18n.t("candidateResult.answer.manual")
      : "—";
  }
  return formatAnswerForDisplay(value, null);
}
