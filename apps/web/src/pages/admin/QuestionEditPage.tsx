import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/apiErrors";
import { resolveListReturnPath } from "@/lib/listReturnNavigation";
import { routes } from "@/lib/routes";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InlineErrorBanner } from "@/components/shared/InlineErrorBanner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  QuestionForm,
  type QuestionFormData,
} from "@/components/question/QuestionForm";
import {
  buildQuestionPayload,
  emptyQuestionFormData,
  questionToFormData,
  validateQuestionForm,
} from "@/components/question/questionPayload";
import { QuestionPreview } from "@/components/question/QuestionPreview";
import { PageContainer } from "@/components/shared/PageContainer";
import type { QuestionDTO } from "@exam/contracts";

/** Admin page for creating or editing a single question with live preview. */
/**
 * Admin page for creating or editing a question, with a side-by-side
 * form and live preview panel.
 */
export function QuestionEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== "new";

  const [formData, setFormData] = useState<QuestionFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isEdit) {
        const q = await api.get<QuestionDTO>(`/api/questions/${id}`);
        setFormData(questionToFormData(q));
      } else {
        setFormData(emptyQuestionFormData());
      }
    } catch {
      setError(t("admin.questionEdit.loadDataFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [id, isEdit, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Persists the question (create or update) and navigates back to the list. */
  async function handleSave() {
    if (!formData || saving) return;
    setSaveError(null);

    // text_response requires a non-empty rubric before save — the empty-string
    // half of the publish gate (publishExam also rejects placeholder rubrics;
    // that half stays server-side). Mirrored here so the author gets immediate
    // feedback instead of a publish-time failure.
    const validationError = validateQuestionForm(formData, t);
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    const payload = buildQuestionPayload(formData);

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/api/questions/${id}`, payload);
      } else {
        await api.post("/api/questions", payload);
      }
      // Return to the list query the user left (URL query state), not to a
      // bare list route: the target is validated against this page's own list
      // route and falls back to it (C2).
      void navigate(
        resolveListReturnPath(location.state, routes.admin.questions),
      );
    } catch (err) {
      const fieldMessage = Object.values(getApiFieldErrors(err)).find(Boolean);
      setSaveError(
        fieldMessage ??
          getApiErrorMessage(err, t, t("admin.questionEdit.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!formData) return null;

  return (
    <PageContainer role="form" className="flex flex-col gap-6">
      <PageHeader
        title={
          isEdit
            ? t("admin.questionEdit.editTitle")
            : t("admin.questionEdit.newTitle")
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <QuestionForm initial={formData} onChange={setFormData} />
        </div>
        <div>
          <QuestionPreview
            type={formData.type}
            content={formData.content}
            contentDocument={formData.contentDocument}
            options={formData.options}
            standardAnswer={formData.standardAnswer}
          />
        </div>
      </div>

      <Separator />
      {saveError && <InlineErrorBanner>{saveError}</InlineErrorBanner>}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() =>
            void navigate(
              resolveListReturnPath(location.state, routes.admin.questions),
            )
          }
          disabled={saving}
        >
          {t("admin.questionEdit.actions.cancel")}
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving
            ? t("admin.questionEdit.actions.saving")
            : t("admin.questionEdit.actions.save")}
        </Button>
      </div>
    </PageContainer>
  );
}
