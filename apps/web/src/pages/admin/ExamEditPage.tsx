import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { fetchAllPickerQuestions } from "@/lib/allQuestions";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InlineErrorBanner } from "@/components/shared/InlineErrorBanner";
import { Button } from "@/components/ui/button";
import {
  ExamConfigForm,
  type ExamConfigData,
} from "@/components/exam/ExamConfigForm";
import { ExamQuestionsEditor } from "@/components/exam/ExamQuestionsEditor";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/shared/PageContainer";
import { FormSection } from "@/components/shared/FormSection";

/** Minimal course representation used in the exam edit form. */
interface CourseRow {
  id: string;
  name: string;
}

/** Minimal question representation used in the exam edit form. */
interface QuestionRow {
  id: string;
  type: string;
  content: string;
}

/** Generic paginated API response wrapper. */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

/** Shape of the GET /api/exams/:id response (ExamDTO subset). */
interface ExamDetailResponse {
  id: string;
  title: string;
  description: string;
  courseId: string;
  status: string;
  timingMode: "timed_window" | "deadline" | "untimed";
  durationMinutes: number | null;
  openAt: string;
  closeAt: string | null;
  passingScore: number;
  totalScore: number;
  questionSelectionMode: string;
  questionIds: string[];
  questionScores?: Record<string, number>;
  controlFlags: Record<string, unknown>;
  retakePolicy: string;
  scoreStrategy: string;
  maxAttempts: number;
  latestStartOffsetMinutes: number | null;
  minSubmitAfterStartMinutes: number | null;
  resultPublicationMode: string;
}

/** Converts an ISO datetime string to the local datetime-local input format. */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local format: YYYY-MM-DDTHH:mm (no seconds, no timezone).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Maps a GET exam response into the ExamConfigData form state. */
function examToConfig(exam: ExamDetailResponse): ExamConfigData {
  return {
    title: exam.title ?? "",
    description: exam.description ?? "",
    courseId: exam.courseId ?? "",
    timingMode: exam.timingMode ?? "timed_window",
    durationMinutes: exam.durationMinutes,
    openAt: isoToLocalInput(exam.openAt),
    closeAt: exam.closeAt ? isoToLocalInput(exam.closeAt) : null,
    passingScore: exam.passingScore ?? 60,
    totalScore: exam.totalScore ?? 100,
    questionSelectionMode:
      (exam.questionSelectionMode as ExamConfigData["questionSelectionMode"]) ??
      "manual",
    questionIds: exam.questionIds ?? [],
    questionScores: exam.questionScores ?? {},
    resultPublicationMode:
      (exam.resultPublicationMode as ExamConfigData["resultPublicationMode"]) ??
      "immediate",
    controlFlags: (exam.controlFlags ?? {}) as ExamConfigData["controlFlags"],
    retakePolicy:
      (exam.retakePolicy as ExamConfigData["retakePolicy"]) ?? "unlimited",
    scoreStrategy:
      (exam.scoreStrategy as ExamConfigData["scoreStrategy"]) ?? "highest",
    maxAttempts: exam.maxAttempts ?? 1,
    latestStartOffsetMinutes: exam.latestStartOffsetMinutes ?? null,
    minSubmitAfterStartMinutes: exam.minSubmitAfterStartMinutes ?? null,
  };
}

/**
 * Admin page for editing an existing exam (draft = full edit; published =
 * schedule-only per backend guard). Reuses ExamConfigForm + question picker
 * from the create page. Saves via PATCH /api/exams/:id.
 */
export function ExamEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [examStatus, setExamStatus] = useState<string>("draft");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [config, setConfig] = useState<ExamConfigData | null>(null);

  /** Loads the exam (for prefill), available courses, and questions in parallel. */
  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [exam, cData, questions] = await Promise.all([
        api.get<ExamDetailResponse>(`/api/exams/${id}`),
        api.get<PaginatedResponse<CourseRow>>("/api/courses"),
        fetchAllPickerQuestions(),
      ]);
      setConfig(examToConfig(exam));
      setExamStatus(exam.status);
      setCourses(cData.items);
      setQuestions(questions);
    } catch {
      setError(t("admin.examEdit.feedback.loadDataFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Validates the form, PATCHes the exam, and navigates to the detail page. */
  async function handleSave() {
    if (!id || !config || saving) return;
    const errors: Record<string, string> = {};
    if (!config.title.trim())
      errors.title = t("admin.examEdit.validation.titleRequired");
    if (!config.courseId)
      errors.courseId = t("admin.examEdit.validation.courseRequired");
    if (
      config.openAt &&
      config.closeAt &&
      new Date(config.closeAt) <= new Date(config.openAt)
    ) {
      errors.time = t("admin.examEdit.validation.timeInvalid");
    }
    if (config.passingScore > config.totalScore) {
      errors.score = t("admin.examEdit.validation.scoreInvalid");
    }
    if (Object.keys(errors).length > 0) {
      toast.error(t("admin.examEdit.feedback.fixErrors"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // For published exams the backend guard only allows schedule fields
      // (openAt/closeAt); strip everything else to avoid a 409 round-trip.
      const scheduleOnly = examStatus === "published";
      const closeAtIso =
        config.closeAt === null || config.closeAt === ""
          ? null
          : new Date(config.closeAt).toISOString();
      const payload = scheduleOnly
        ? {
            openAt: config.openAt
              ? new Date(config.openAt).toISOString()
              : undefined,
            closeAt: closeAtIso ?? undefined,
          }
        : {
            ...config,
            openAt: config.openAt
              ? new Date(config.openAt).toISOString()
              : undefined,
            closeAt: closeAtIso,
          };
      await api.patch(`/api/exams/${id}`, payload);
      toast.success(t("admin.examEdit.feedback.updateSuccess"));
      void navigate(`/admin/exams/${id}`);
    } catch (err) {
      const message = getApiErrorMessage(
        err,
        t,
        t("admin.examEdit.feedback.saveFailed"),
      );
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!config)
    return (
      <ErrorState
        message={t("admin.examEdit.feedback.loadConfigFailed")}
        onRetry={loadData}
      />
    );

  const scheduleOnly = examStatus === "published";

  return (
    <PageContainer role="form" className="flex flex-col gap-6">
      <PageHeader title={t("admin.examEdit.pageTitle")} />

      {scheduleOnly && (
        <Alert>
          <AlertDescription>
            {t("admin.examEdit.publishedAlert")}
          </AlertDescription>
        </Alert>
      )}

      <ExamConfigForm
        courses={courses}
        questions={config.questionIds.map((qid) => ({
          id: qid,
          score: config.questionScores[qid] ?? 1,
        }))}
        data={config}
        onChange={setConfig}
      />

      <FormSection title={t("admin.examWizard.steps.questions")}>
        <ExamQuestionsEditor
          questionIds={config.questionIds}
          questionScores={config.questionScores}
          bank={questions}
          readOnly={scheduleOnly}
          onChange={({ questionIds, questionScores }) =>
            setConfig({ ...config, questionIds, questionScores })
          }
          onBankChange={setQuestions}
        />
      </FormSection>

      <Separator />
      {saveError && <InlineErrorBanner>{saveError}</InlineErrorBanner>}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => void navigate(`/admin/exams/${id}`)}
        >
          {t("admin.examEdit.actions.cancel")}
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving
            ? t("admin.examEdit.actions.saving")
            : t("admin.examEdit.actions.save")}
        </Button>
      </div>
    </PageContainer>
  );
}
