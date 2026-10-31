import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { CircleX, Clock, Hourglass, TriangleAlert } from "lucide-react";
import { AppIcon } from "@/components/shared/AppIcon";
import { useNavigate, useParams } from "react-router";
import type { ContentDocumentV1 } from "@exam/domain";
import { type CandidateAttemptResultResponse } from "@exam/contracts";
import { api } from "@/lib/api";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { QuestionReviewList } from "@/components/shared/QuestionReviewList";
import { PageContainer } from "@/components/shared/PageContainer";

/** The hidden response variant of the candidate attempt-result contract. */
type HiddenAttemptResult = Extract<
  CandidateAttemptResultResponse,
  { showResultImmediately: false }
>;

/**
 * Status projection (icon + copy) for a hidden candidate result (#698).
 *
 * INVARIANT: for a non-graded attempt the wire `status` is the lifecycle-copy
 * authority — `hiddenReason` stays the engine's historical catch-all
 * ("not_started") there and must not be rendered literally; only a graded
 * attempt's `hiddenReason` names the gate still withholding the computable
 * result (resolveCandidateResultVisibility two-stage gate).
 */
function hiddenResultPresentation(
  result: HiddenAttemptResult,
  t: (key: string) => string,
): { icon: LucideIcon; tone: string; message: string } {
  if (result.status !== "graded") {
    switch (result.status) {
      case "in_progress":
        return {
          icon: Clock,
          tone: "text-muted-foreground",
          message: t("candidateResult.status.in_progress"),
        };
      case "submitted":
        return {
          icon: Hourglass,
          tone: "text-muted-foreground",
          message: t("candidateResult.status.submitted"),
        };
      case "disrupted":
        return {
          icon: TriangleAlert,
          tone: "text-warning",
          message: t("candidateResult.status.disrupted"),
        };
      case "voided":
        return {
          icon: CircleX,
          tone: "text-destructive",
          message: t("candidateResult.status.voided"),
        };
      case "not_started":
        return {
          icon: Clock,
          tone: "text-muted-foreground",
          message: t("candidateResult.status.not_started"),
        };
      case "queued":
        return {
          icon: Clock,
          tone: "text-muted-foreground",
          message: t("candidateResult.status.queued"),
        };
      default: {
        // INVARIANT (compile-time drift guard): with every non-graded wire
        // status mapped above, `result.status` is `never` here; a future
        // AttemptStatus extension without a mapped message fails typecheck
        // instead of silently sliding into the neutral fallback below. The
        // return keeps a runtime fallback for untyped/unknown payloads.
        const unhandled: never = result.status;
        void unhandled;
        return {
          icon: Hourglass,
          tone: "text-muted-foreground",
          message: t("candidateResult.status.default"),
        };
      }
    }
  }
  // Graded but withheld: hiddenReason names the still-closed gate.
  switch (result.hiddenReason) {
    case "not_graded":
      return {
        icon: Hourglass,
        tone: "text-muted-foreground",
        message: t("candidateResult.status.not_graded"),
      };
    case "pending_publish":
      return {
        icon: Hourglass,
        tone: "text-muted-foreground",
        message: t("candidateResult.status.pending_publish"),
      };
    default:
      // hiddenReason is optional on the wire — the fallback must not assert
      // any particular lifecycle state.
      return {
        icon: Hourglass,
        tone: "text-muted-foreground",
        message: t("candidateResult.status.default"),
      };
  }
}

/** Displays the scored result of a single exam attempt, including per-question breakdown or a pending-status message. */
export function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [result, setResult] = useState<CandidateAttemptResultResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  /** Fetches the attempt result from the scores API. */
  const loadResult = useCallback(async () => {
    if (!attemptId) return;
    setError(null);
    try {
      // Candidate-safe result contract (EXSEM-017): the DTO structurally
      // cannot carry standardAnswer/rubric/gradingRule.
      setResult(
        await api.get<CandidateAttemptResultResponse>(
          `/api/scores/attempts/${attemptId}`,
        ),
      );
    } catch {
      setError(t("candidateResult.error.loadFailed"));
    }
  }, [attemptId, t]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  if (error) return <ErrorState message={error} onRetry={loadResult} />;
  if (!result) return <LoadingState />;

  // Hidden-result projection; null on the visible variant (see
  // hiddenResultPresentation for the status-vs-hiddenReason authority split).
  const hiddenView = result.showResultImmediately
    ? null
    : hiddenResultPresentation(result, t as (key: string) => string);

  return (
    <PageContainer role="candidate" className="flex flex-col gap-6">
      <h1 className="type-page-title">{result.examTitle}</h1>

      {result.showResultImmediately ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("candidateResult.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-center">
              <p className="type-metric-hero" data-testid="result-total-score">
                {result.totalScore}
              </p>
              <p className="type-secondary">
                {t("candidateResult.summary.passingScore", {
                  score: result.passingScore,
                })}
              </p>
              <p
                className={
                  result.passed
                    ? "font-medium text-success"
                    : "font-medium text-destructive"
                }
              >
                {result.passed
                  ? t("candidateResult.summary.passed")
                  : t("candidateResult.summary.failed")}
              </p>
            </CardContent>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="type-section-title">
              {t("candidateResult.detail.title")}
            </h2>
            <QuestionReviewList
              items={result.questionResults.map((question) => ({
                ...question,
                contentDocument:
                  (question.contentDocument as ContentDocumentV1 | null) ??
                  null,
                answerMode: question.answerMode ?? null,
                options: question.options ?? [],
              }))}
              showCorrectAnswer={false}
              mode="result"
              typeLabels="candidateResult.questionTypes"
            />
          </section>
        </>
      ) : (
        hiddenView && (
          <Card>
            <CardContent className="py-10 text-center">
              <AppIcon
                icon={hiddenView.icon}
                size="state"
                className={`mx-auto mb-3 ${hiddenView.tone}`}
              />
              <p
                className="text-lg font-medium"
                data-testid="result-status-message"
              >
                {hiddenView.message}
              </p>
            </CardContent>
          </Card>
        )
      )}

      <div className="flex justify-end">
        <Button onClick={() => navigate(routes.exam.list)}>
          {t("candidateResult.actions.backToList")}
        </Button>
      </div>
    </PageContainer>
  );
}
