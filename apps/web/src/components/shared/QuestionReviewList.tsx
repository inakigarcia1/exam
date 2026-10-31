import { useTranslation } from "react-i18next";
import { CircleCheck, CircleX } from "lucide-react";
import { resolveRichAnswerDocument } from "@exam/contracts";
import type { ContentDocumentV1 } from "@exam/domain";
import { AppIcon } from "@/components/shared/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ContentDocumentRenderer } from "@/components/shared/content/ContentDocumentRenderer";
import {
  formatAnswerForDisplay,
  formatStandardAnswerForDisplay,
} from "@/lib/answerDisplay";
import { cn } from "@/lib/utils";

export type QuestionReviewOption = {
  id: string;
  content: string;
  contentDocument: ContentDocumentV1 | null;
};

export type QuestionReviewItem = {
  questionId: string;
  order: number;
  type: string;
  content: string;
  contentDocument: ContentDocumentV1 | null;
  answerMode: string | null;
  options: QuestionReviewOption[];
  candidateAnswer?: unknown;
  standardAnswer?: unknown;
  score?: number;
  maxScore?: number;
  correct?: boolean;
  comment?: string | null;
  manualGraded?: boolean;
};

type QuestionReviewListProps = {
  items: QuestionReviewItem[];
  showCorrectAnswer: boolean;
  mode: "result" | "live";
  answerLabel?: string;
  correctAnswerLabel?: string;
  typeLabels?: "questionType" | "candidateResult.questionTypes";
};

function QuestionPrompt({ item }: { item: QuestionReviewItem }) {
  if (item.contentDocument) {
    return <ContentDocumentRenderer document={item.contentDocument} />;
  }
  return <p className="break-words whitespace-pre-wrap">{item.content}</p>;
}

function RichAnswerBlock({
  answer,
  answerMode,
}: {
  answer: unknown;
  answerMode: string | null;
}) {
  const richDocument = resolveRichAnswerDocument(answer, answerMode);
  if (richDocument) {
    return <ContentDocumentRenderer document={richDocument} />;
  }
  return (
    <p className="break-words whitespace-pre-wrap">
      {formatAnswerForDisplay(answer, answerMode)}
    </p>
  );
}

function normalizeSelectedIds(answer: unknown): string[] {
  if (answer == null) return [];
  if (Array.isArray(answer)) {
    return answer.map(String);
  }
  if (typeof answer === "string") return [answer];
  return [String(answer)];
}

function isChoiceType(type: string): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "true_false"
  );
}

export function QuestionReviewList({
  items,
  showCorrectAnswer,
  mode,
  answerLabel,
  correctAnswerLabel,
  typeLabels = "questionType",
}: QuestionReviewListProps) {
  const { t } = useTranslation();
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const yourAnswerLabel = answerLabel ?? t("candidateResult.table.yourAnswer");
  const referenceLabel =
    correctAnswerLabel ?? t("candidateResult.table.correctAnswer");

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((item, index) => {
        const selectedIds = normalizeSelectedIds(item.candidateAnswer);
        const correctIds = showCorrectAnswer
          ? normalizeSelectedIds(item.standardAnswer)
          : [];

        return (
          <Card
            key={item.questionId}
            data-testid={`question-review-${item.questionId}`}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-secondary">
                    {t("questionReview.questionNumber", { n: index + 1 })}
                  </span>
                  <Badge variant="outline">
                    {t(`${typeLabels}.${item.type}` as never)}
                  </Badge>
                </div>
                {mode === "result" && (
                  <div className="flex shrink-0 items-center gap-2">
                    {item.correct != null && (
                      <AppIcon
                        icon={item.correct ? CircleCheck : CircleX}
                        decorative={false}
                        label={
                          item.correct
                            ? t("candidateResult.aria.correct")
                            : t("candidateResult.aria.incorrect")
                        }
                        size="inline"
                        className={
                          item.correct ? "text-success" : "text-destructive"
                        }
                      />
                    )}
                    {item.score != null && item.maxScore != null && (
                      <span className="type-secondary">
                        {item.score}/{item.maxScore}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <QuestionPrompt item={item} />

              {isChoiceType(item.type) && item.options.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {item.options.map((option) => {
                    const selected = selectedIds.includes(option.id);
                    const isCorrectOption = correctIds.includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          "rounded-md border px-3 py-2 break-words",
                          selected && "border-primary bg-muted/40",
                          showCorrectAnswer &&
                            isCorrectOption &&
                            "border-success",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {mode === "result" && selected && (
                            <AppIcon
                              icon={item.correct ? CircleCheck : CircleX}
                              size="badge"
                              className={
                                item.correct
                                  ? "text-success shrink-0"
                                  : "text-destructive shrink-0"
                              }
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            {option.contentDocument ? (
                              <ContentDocumentRenderer
                                document={option.contentDocument}
                              />
                            ) : (
                              option.content
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="type-label">{yourAnswerLabel}</span>
                  <RichAnswerBlock
                    answer={item.candidateAnswer}
                    answerMode={item.answerMode}
                  />
                </div>
              )}

              {showCorrectAnswer &&
                mode === "result" &&
                !isChoiceType(item.type) && (
                  <div className="flex flex-col gap-1">
                    <span className="type-label">{referenceLabel}</span>
                    <p className="break-words whitespace-pre-wrap">
                      {item.manualGraded && item.type === "text_response"
                        ? t("candidateResult.answer.manual")
                        : formatStandardAnswerForDisplay(
                            item.standardAnswer,
                            item.type,
                          )}
                    </p>
                  </div>
                )}

              {mode === "result" && item.comment?.trim() && (
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="type-label">
                    {t("questionReview.teacherComment")}
                  </span>
                  <p className="break-words whitespace-pre-wrap">
                    {item.comment}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
