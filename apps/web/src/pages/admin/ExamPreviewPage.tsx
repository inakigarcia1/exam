import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { ExamPreviewResponse } from "@exam/contracts";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { takeQuestionToRendererSnapshot } from "@/lib/examTypes";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdminConsole } from "@/lib/capabilities";
import { AccessDeniedPage } from "@/pages/admin/AccessDeniedPage";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageContainer } from "@/components/shared/PageContainer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { ContentRenderer } from "@/components/shared/content/ContentRenderer";
import { QuestionRenderer } from "@/components/exam/QuestionRenderer";

export function ExamPreviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preview, setPreview] = useState<ExamPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<ExamPreviewResponse>(
        `/api/exams/${id}/preview`,
      );
      setPreview(data);
    } catch (err) {
      setError(
        getApiErrorMessage(err, t, t("admin.examPreview.errors.loadFailed")),
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const questionStates = useMemo(() => {
    if (!preview) return [];
    return preview.questions.map((q) =>
      answers[q.id] != null && answers[q.id] !== "" ? "answered" : "unanswered",
    );
  }, [preview, answers]);

  if (!user || !canAccessAdminConsole(user)) {
    return <AccessDeniedPage />;
  }
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!preview) return null;

  const current = preview.questions[currentIndex];
  if (!current) {
    return <ErrorState message={t("admin.examPreview.empty")} />;
  }
  const rendererQuestion = takeQuestionToRendererSnapshot(
    current,
    currentIndex,
  );

  return (
    <PageContainer role="candidate" className="flex min-h-screen flex-col">
      <div className="border-b bg-background px-4 py-3">
        <Alert>
          <AlertDescription>{t("admin.examPreview.banner")}</AlertDescription>
        </Alert>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="type-title">{preview.title}</h1>
          {preview.timingMode === "timed_window" && preview.durationMinutes && (
            <Badge variant="secondary">
              {t("admin.examPreview.duration", {
                minutes: preview.durationMinutes,
              })}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void navigate(-1)}
          >
            {t("admin.examPreview.close")}
          </Button>
        </div>
        {preview.description && (
          <p className="type-secondary mt-2">{preview.description}</p>
        )}
      </div>

      <div className="flex flex-1 gap-4 p-4">
        <aside className="hidden w-56 shrink-0 md:block">
          <QuestionNavigator
            items={preview.questions.map((q, i) => ({
              id: q.id,
              number: i + 1,
              state: questionStates[i] ?? "unanswered",
            }))}
            currentId={current.id}
            onSelect={(qid) => {
              const idx = preview.questions.findIndex((q) => q.id === qid);
              if (idx >= 0) setCurrentIndex(idx);
            }}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <section className="mx-auto max-w-4xl rounded-lg border bg-card p-6">
            <ContentRenderer
              content={current.prompt}
              document={current.promptDocument}
            />
            <div className="mt-6">
              <QuestionRenderer
                question={rendererQuestion}
                answer={answers[current.id]}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, [current.id]: value }))
                }
                disabled={false}
              />
            </div>
          </section>
          <div className="mx-auto mt-4 flex max-w-4xl justify-between gap-2">
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              {t("candidateRuntime.actions.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={currentIndex >= preview.questions.length - 1}
              onClick={() =>
                setCurrentIndex((i) =>
                  Math.min(preview.questions.length - 1, i + 1),
                )
              }
            >
              {t("candidateRuntime.actions.next")}
            </Button>
          </div>
          <p className="type-secondary mx-auto mt-4 max-w-4xl text-center text-sm">
            {t("admin.examPreview.submitDisabled")}
          </p>
        </main>
      </div>
    </PageContainer>
  );
}
