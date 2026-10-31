import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { AttemptLiveViewResponse } from "@exam/contracts";
import { api } from "@/lib/api";
import { routes } from "@/lib/routes";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageContainer } from "@/components/shared/PageContainer";
import { QuestionReviewList } from "@/components/shared/QuestionReviewList";
import { useProductDateTime } from "@/contexts/DateTimeContext";

const LIVE_STATUSES = new Set(["in_progress", "disrupted"]);

export function AttemptLiveViewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { formatDateTime } = useProductDateTime();
  const [data, setData] = useState<AttemptLiveViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!attemptId) return;
    try {
      const response = await api.get<AttemptLiveViewResponse>(
        `/api/admin/attempts/${attemptId}/live`,
      );
      setData(response);
      setError(null);
    } catch {
      setError(t("admin.attemptLive.errors.loadFailed"));
    }
  }, [attemptId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!attemptId || !data || !LIVE_STATUSES.has(data.status)) return;
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [attemptId, data, load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const isLive = LIVE_STATUSES.has(data.status);

  return (
    <PageContainer role="admin-standard" className="flex flex-col gap-6">
      <PageHeader
        title={`${data.candidateName} (${data.candidateUsername})`}
        description={data.examTitle}
        actions={
          <Button
            variant="outline"
            onClick={() => navigate(routes.admin.examProctor(data.examId))}
          >
            {t("admin.attemptLive.actions.backToProctor")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 type-secondary">
        <StatusBadge status={data.status} />
        {data.deadlineAt && (
          <span>
            {t("admin.attemptLive.meta.deadline")}:{" "}
            {formatDateTime(data.deadlineAt)}
          </span>
        )}
        {data.lastActivityAt && (
          <span>
            {t("admin.attemptLive.meta.lastActivity")}:{" "}
            {formatDateTime(data.lastActivityAt)}
          </span>
        )}
      </div>

      {!isLive && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p>{t("admin.attemptLive.submittedNotice")}</p>
          <Button
            variant="outline"
            onClick={() => navigate(routes.admin.attemptDetail(data.attemptId))}
          >
            {t("admin.attemptLive.actions.viewAttempt")}
          </Button>
        </div>
      )}

      <QuestionReviewList
        items={data.questions.map((question) => ({
          ...question,
          candidateAnswer: question.currentAnswer,
          options: question.options,
        }))}
        showCorrectAnswer={false}
        mode="live"
        answerLabel={t("admin.attemptLive.answerLabel")}
      />
    </PageContainer>
  );
}
