import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { fetchAllPickerQuestions } from "@/lib/allQuestions";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/apiErrors";
import { resolveListReturnPath } from "@/lib/listReturnNavigation";
import { routes } from "@/lib/routes";
import { useProductDateTime } from "@/contexts/DateTimeContext";
import {
  buildWizardPolicyPreview,
  type WizardProfileLike,
} from "@/lib/wizardPolicyPreview";
import {
  summarizeProfile,
  type ProfileSummaryLabels,
} from "@/lib/examProfileSummary";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InlineErrorBanner } from "@/components/shared/InlineErrorBanner";
import { FormSection } from "@/components/shared/FormSection";
import { FieldGroup, Field, FieldRow } from "@/components/shared/FieldGroup";
import { FieldError } from "@/components/shared/FieldError";
import { DefinitionList } from "@/components/shared/DefinitionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { AppIcon } from "@/components/shared/AppIcon";
import { WizardStepper } from "@/components/exam/wizard/WizardStepper";
import { ExamQuestionsEditor } from "@/components/exam/ExamQuestionsEditor";
import { WizardPolicyFields } from "@/components/exam/wizard/WizardPolicyFields";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  buildCreateExamPayload,
  goToStep,
  initialWizardState,
  selectProfile,
  setOverride,
  setInterruptionPolicyOverride,
  clearOverride,
  WIZARD_CODE_DEFAULTS,
  WIZARD_TOTAL_STEPS,
  type WizardState,
} from "@/components/exam/wizard/wizardState";
import type { ExamProfilePolicyDefaults } from "@exam/domain";
import type { ExamProfileDTO } from "@exam/contracts";

interface CourseRow {
  id: string;
  name: string;
}
interface QuestionRow {
  id: string;
  type: string;
  content: string;
}
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  totalPages: number;
}

/**
 * Error keys each wizard step owns: local validation keys plus the server
 * field names `stepForField` may route here. Used to drop stale errors when a
 * step is re-validated, so a fixed field never keeps a ghost error.
 */
const STEP_FIELD_KEYS: Record<number, string[]> = {
  1: ["title", "courseId", "profileId"],
  2: [
    "durationMinutes",
    "latestStartOffsetMinutes",
    "minSubmitAfterStartMinutes",
    "retakePolicy",
    "maxAttempts",
    "scoreStrategy",
    "resultPublicationMode",
    "interruptionTimePolicy",
    "interruptionGracePerIncidentSeconds",
    "interruptionGracePerAttemptSeconds",
  ],
  3: ["score", "questionIds", "totalScore", "passingScore"],
  4: ["time", "openAt", "closeAt"],
  5: [],
};

/** Map a server validation field name to the wizard step that owns it. */
function stepForField(field: string): number {
  for (const [step, keys] of Object.entries(STEP_FIELD_KEYS)) {
    if (keys.includes(field)) return Number(step);
  }
  return 5;
}

/**
 * Resolve the i18n label source for summarizeProfile. Kept here (near the only
 * wizard consumer) to avoid a second hook in the shared lib.
 */
function useSummaryLabels(): ProfileSummaryLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      durationMinutes: (m) =>
        m === null
          ? t("admin.examProfilePages.summaryNoDuration")
          : t("admin.examProfilePages.summaryDuration", { count: m }),
      latestStart: (m) =>
        t("admin.examProfilePages.summaryLatestStart", { count: m }),
      minSubmit: (m) =>
        t("admin.examProfilePages.summaryMinSubmit", { count: m }),
      retake: {
        unlimited: t("admin.examProfilePages.enumLabels.retakePolicyUnlimited"),
        maxAttempts: (n) =>
          t("admin.examProfilePages.summaryMaxAttempts", { count: n }),
        passThenStop: t(
          "admin.examProfilePages.enumLabels.retakePolicyPassThenStop",
        ),
      },
      scoreStrategy: {
        highest: t("admin.examProfilePages.enumLabels.scoreStrategyHighest"),
        latest: t("admin.examProfilePages.enumLabels.scoreStrategyLatest"),
        first: t("admin.examProfilePages.enumLabels.scoreStrategyFirst"),
      },
      resultPublication: {
        immediate: t(
          "admin.examProfilePages.enumLabels.resultPublicationImmediate",
        ),
        afterGrading: t(
          "admin.examProfilePages.enumLabels.resultPublicationAfterGrading",
        ),
        manual: t("admin.examProfilePages.enumLabels.resultPublicationManual"),
      },
      interruption: {
        strict: t("admin.examProfilePages.enumLabels.interruptionStrict"),
        boundedGrace: t(
          "admin.examProfilePages.enumLabels.interruptionBoundedGrace",
        ),
        operatorIncident: t(
          "admin.examProfilePages.enumLabels.interruptionOperatorIncident",
        ),
      },
      separator: " · ",
    }),
    [t],
  );
}

/**
 * Exam creation wizard — a guided multi-step flow that creates a Draft Exam;
 * publishing stays on the exam detail page.
 *
 * Latent control flags are NOT shown (truthfulness rule: only enforced
 * dimensions surface in this entry).
 */
export function ExamCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const summaryLabels = useSummaryLabels();
  const { formatDateTime } = useProductDateTime();

  const [state, setState] = useState<WizardState>(initialWizardState);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [subjectId, setSubjectId] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionName, setCommissionName] = useState("");
  const [commissionSubjectId, setCommissionSubjectId] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);
  const [restrictSimultaneous, setRestrictSimultaneous] = useState(false);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [profiles, setProfiles] = useState<ExamProfileDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manualTotalScore, setManualTotalScore] = useState(false);
  // The Puntaje de aprobación default (60) follows the auto-calculated Puntaje total until the user
  // edits it explicitly (see the auto-calc effect below).
  const [passingScoreTouched, setPassingScoreTouched] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [pData, questions, subjectData] = await Promise.all([
        api.get<ExamProfileDTO[]>("/api/exam-profiles"),
        fetchAllPickerQuestions(),
        api.get<{ items: Array<{ id: string; name: string }> }>(
          "/api/subjects",
        ),
      ]);
      setSubjects(subjectData.items);
      setProfiles(pData);
      setQuestions(questions);
    } catch {
      setError(t("admin.examWizard.feedback.loadDataFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!subjectId) {
      setCourses([]);
      setState((current) => ({ ...current, courseId: "" }));
      return;
    }
    let cancelled = false;
    void api
      .get<PaginatedResponse<CourseRow>>(
        `/api/courses?subjectId=${subjectId}&pageSize=100`,
      )
      .then((data) => {
        if (cancelled) return;
        setCourses(data.items);
        setState((current) => ({
          ...current,
          courseId: data.items.some((course) => course.id === current.courseId)
            ? current.courseId
            : "",
        }));
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  useEffect(() => {
    const profile = profiles.find((item) => item.id === state.profileId);
    if (!profile) return;
    setRestrictSimultaneous(profile.restrictSimultaneousAccess === true);
  }, [state.profileId, profiles]);

  const selectedProfile: WizardProfileLike | null = useMemo(() => {
    if (!state.profileId) return null;
    const p = profiles.find((x) => x.id === state.profileId);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      defaults: {
        timingMode: p.timingMode,
        durationMinutes: p.durationMinutes,
        latestStartOffsetMinutes: p.latestStartOffsetMinutes,
        minSubmitAfterStartMinutes: p.minSubmitAfterStartMinutes,
        retakePolicy: p.retakePolicy,
        maxAttempts: p.maxAttempts,
        scoreStrategy: p.scoreStrategy,
        resultPublicationMode: p.resultPublicationMode,
        interruptionTimePolicy: p.interruptionTimePolicy,
        interruptionGracePerIncidentSeconds:
          p.interruptionGracePerIncidentSeconds,
        interruptionGracePerAttemptSeconds:
          p.interruptionGracePerAttemptSeconds,
      },
    };
  }, [state.profileId, profiles]);

  const preview = useMemo(
    () =>
      buildWizardPolicyPreview({
        profile: selectedProfile,
        overrides: state.overrides,
        codeDefaults: WIZARD_CODE_DEFAULTS,
      }),
    [selectedProfile, state.overrides],
  );

  // ── state mutators (thin wrappers over wizardState helpers) ──
  const setStep = (step: number) => setState((s) => goToStep(s, step));
  const onSelectProfile = (id: string | null) =>
    setState((s) => selectProfile(s, id));
  const onSetOverride = (
    field: keyof ExamProfilePolicyDefaults,
    value: ExamProfilePolicyDefaults[keyof ExamProfilePolicyDefaults] | null,
  ) =>
    setState((s) =>
      field === "interruptionTimePolicy"
        ? // Atomic policy write: leaving bounded_grace also nulls both grace
          // caps, so profile-supplied caps can't leak into strict /
          // operator_incident (ADR-013). Mirrors ExamProfileEditPage.
          setInterruptionPolicyOverride(
            s,
            value as ExamProfilePolicyDefaults["interruptionTimePolicy"],
          )
        : // Explicit key type argument: the field narrowing on this branch
          // would otherwise shrink the generic key union and reject the
          // full-union value.
          setOverride<keyof ExamProfilePolicyDefaults>(s, field, value),
    );
  const onClearOverride = (field: keyof ExamProfilePolicyDefaults) =>
    setState((s) => clearOverride(s, field));

  // ── per-step validation ──
  function validateCurrentStep(): boolean {
    const errors: Record<string, string> = {};
    if (state.step === 1) {
      if (!state.title.trim())
        errors.title = t("admin.examWizard.validation.titleRequired");
      if (!subjectId) errors.subjectId = "Elegí una materia";
      if (!state.courseId)
        errors.courseId = t("admin.examWizard.validation.courseRequired");
    }
    if (state.step === 2) {
      // User-supplied policy values must stay in their valid domain; the
      // profile/default fallback is already valid (validated on save).
      if (
        preview.resolved.timingMode === "timed_window" &&
        preview.resolved.durationMinutes !== null &&
        preview.resolved.durationMinutes < 1
      ) {
        errors.durationMinutes = t(
          "admin.examWizard.validation.durationRequired",
        );
      }
      if (
        preview.resolved.retakePolicy === "max_attempts" &&
        preview.resolved.maxAttempts < 1
      ) {
        errors.maxAttempts = t(
          "admin.examWizard.validation.maxAttemptsInvalid",
        );
      }
    }
    if (state.step === 3) {
      if (state.passingScore > state.totalScore)
        errors.score = t("admin.examWizard.validation.scoreInvalid");
    }
    if (state.step === 4) {
      if (
        preview.resolved.timingMode !== "untimed" &&
        (!state.openAt || !state.closeAt)
      )
        errors.time = t("admin.examWizard.validation.timeRequired");
      else if (new Date(state.closeAt) <= new Date(state.openAt))
        errors.time = t("admin.examWizard.validation.timeInvalid");
    }
    // Drop this step's stale errors (local + server field names) before
    // merging the fresh result, so a fixed field never keeps a ghost error.
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of STEP_FIELD_KEYS[state.step] ?? []) delete next[key];
      return { ...next, ...errors };
    });
    return Object.keys(errors).length === 0;
  }

  function next() {
    if (!validateCurrentStep()) {
      toast.error(t("admin.examWizard.feedback.fixErrors"));
      return;
    }
    setStep(state.step + 1);
  }
  function prev() {
    setStep(state.step - 1);
  }

  function openSubjectDialog() {
    setSubjectName("");
    setSubjectOpen(true);
  }

  async function saveSubject() {
    const name = subjectName.trim();
    if (!name) return;
    setSavingSubject(true);
    try {
      const created = await api.post<{ id: string; name: string }>(
        "/api/subjects",
        { name },
      );
      setSubjects((current) => [
        ...current,
        { id: created.id, name: created.name },
      ]);
      setSubjectId(created.id);
      setSubjectOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, "No se pudo guardar la materia"));
    } finally {
      setSavingSubject(false);
    }
  }

  function openCommissionDialog() {
    if (!subjectId) return;
    setCommissionName("");
    setCommissionSubjectId(subjectId);
    setCommissionOpen(true);
  }

  async function saveCommission() {
    const name = commissionName.trim();
    if (!name || !commissionSubjectId) return;
    setSavingCommission(true);
    try {
      const created = await api.post<{ id: string }>("/api/courses", {
        name,
        description: "",
        subjectId: commissionSubjectId,
      });
      setCommissionOpen(false);
      if (commissionSubjectId === subjectId) {
        const data = await api.get<PaginatedResponse<CourseRow>>(
          `/api/courses?subjectId=${subjectId}&pageSize=100`,
        );
        setCourses(data.items);
        setState((current) => ({ ...current, courseId: created.id }));
      } else {
        toast.success("Comisión creada");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, t("admin.common.saveFailed")));
    } finally {
      setSavingCommission(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const payload = {
        ...buildCreateExamPayload(state, preview.resolved),
        subjectId,
        controlFlags: { restrictSimultaneousAccess: restrictSimultaneous },
      };
      const exam = await api.post<{ id: string }>("/api/exams", payload);
      toast.success(t("admin.examWizard.feedback.createSuccess"));
      void navigate(`/admin/exams/${exam.id}`);
    } catch (err) {
      const fieldMap = getApiFieldErrors(err);
      if (Object.keys(fieldMap).length > 0) {
        setFieldErrors(fieldMap);
        // Route the user to the relevant step for the first mapped field.
        const firstField = Object.keys(fieldMap)[0];
        if (firstField) setStep(stepForField(firstField));
      }
      const message = getApiErrorMessage(
        err,
        t,
        t("admin.examWizard.feedback.createFailed"),
      );
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const computedTotal = state.questionIds.reduce(
    (sum, id) => sum + (state.questionScores[id] ?? 1),
    0,
  );
  const hasQuestions = state.questionIds.length > 0;

  // Auto-calc totalScore from the selected questions whenever the selection
  // changes. The publish gate requires totalScore === sum(question scores);
  // auto-calc prevents avoidable publish-time 400s. The user may switch to
  // manual entry.
  useEffect(() => {
    if (!hasQuestions || manualTotalScore || computedTotal <= 0) return;
    setState((s) => {
      let next = s;
      if (s.totalScore !== computedTotal) {
        next = { ...next, totalScore: computedTotal };
      }
      // While the Puntaje de aprobación has not been explicitly edited, it tracks the auto
      // total at the 60% convention (like the default for a 100-point exam).
      // Without this, the untouched default (60) can exceed a small total and
      // leave step 3 born in an error state; explicit user edits are never
      // overwritten.
      if (!passingScoreTouched) {
        const defaultPassing = Math.max(1, Math.round(computedTotal * 0.6));
        if (next.passingScore !== defaultPassing) {
          next = { ...next, passingScore: defaultPassing };
        }
      }
      return next;
    });
  }, [computedTotal, hasQuestions, manualTotalScore, passingScoreTouched]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <PageContainer role="form" className="flex flex-col gap-6">
      <PageHeader
        title={t("admin.examWizard.pageTitle")}
        description={t("admin.examWizard.pageDescription")}
      />

      <WizardStepper current={state.step} onNavigate={(s) => setStep(s)} />

      {/* Step 1 — basic info + profile picker */}
      {state.step === 1 && (
        <FieldGroup>
          <FormSection title={t("admin.examWizard.steps.basic")}>
            <Field>
              <Label htmlFor="wiz-title">
                {t("admin.examWizard.fields.title")}
              </Label>
              <Input
                id="wiz-title"
                value={state.title}
                onChange={(e) =>
                  setState((s) => ({ ...s, title: e.target.value }))
                }
                placeholder={t("admin.examWizard.fields.titlePlaceholder")}
              />
              <FieldError>{fieldErrors.title}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="wiz-subject">Materia</Label>
              <div className="flex gap-2">
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger
                    id="wiz-subject"
                    aria-label="Materia"
                    className="flex-1"
                  >
                    <SelectValue placeholder="Elegí una materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Nueva materia"
                  onClick={openSubjectDialog}
                >
                  <AppIcon icon={Plus} size="inline" />
                </Button>
              </div>
              <FieldError>{fieldErrors.subjectId}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="wiz-course">
                {t("admin.examWizard.fields.course")}
              </Label>
              <div className="flex gap-2">
                <Select
                  value={state.courseId}
                  onValueChange={(v) =>
                    setState((s) => ({ ...s, courseId: v }))
                  }
                  disabled={!subjectId}
                >
                  <SelectTrigger
                    id="wiz-course"
                    aria-label={t("admin.examWizard.fields.course")}
                    className="flex-1"
                  >
                    <SelectValue
                      placeholder={
                        subjectId
                          ? t("admin.examWizard.fields.coursePlaceholder")
                          : "Primero elegí una materia"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Nueva comisión"
                  disabled={!subjectId}
                  onClick={openCommissionDialog}
                >
                  <AppIcon icon={Plus} size="inline" />
                </Button>
              </div>
              <FieldError>{fieldErrors.courseId}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="wiz-description">
                {t("admin.examWizard.fields.description")}
              </Label>
              <Input
                id="wiz-description"
                value={state.description}
                onChange={(e) =>
                  setState((s) => ({ ...s, description: e.target.value }))
                }
                placeholder={t(
                  "admin.examWizard.fields.descriptionPlaceholder",
                )}
              />
            </Field>
          </FormSection>

          <FormSection
            title={t("admin.examWizard.steps.policy")}
            description={t("admin.examWizard.copyOnApplyHint")}
          >
            <Field>
              <Label>
                {t("admin.examWizard.profileSource.existingProfile")}
              </Label>
              <Select
                value={state.profileId ?? "__none__"}
                onValueChange={(v) =>
                  onSelectProfile(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger
                  aria-label={t(
                    "admin.examWizard.profileSource.existingProfile",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("admin.examWizard.profileSource.none")}
                  </SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="type-metadata">
                {state.profileId
                  ? t("admin.examWizard.copyOnApplyHint")
                  : t("admin.examWizard.noProfileHint")}
              </p>
            </Field>
          </FormSection>
        </FieldGroup>
      )}

      {/* Step 2 — policy fields (profile-safe, enforced dimensions only) */}
      {state.step === 2 && (
        <>
          <WizardPolicyFields
            state={state}
            selectedProfile={selectedProfile}
            fieldErrors={fieldErrors}
            setOverride={onSetOverride}
            clearOverride={onClearOverride}
          />
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="wiz-simultaneous"
              checked={restrictSimultaneous}
              onCheckedChange={(v) => setRestrictSimultaneous(v === true)}
            />
            <Label htmlFor="wiz-simultaneous" className="font-normal">
              Restringir acceso simultáneo
            </Label>
          </div>
        </>
      )}

      {/* Step 3 — questions + scores */}
      {state.step === 3 && (
        <FieldGroup>
          <FormSection title={t("admin.examWizard.steps.questions")}>
            <ExamQuestionsEditor
              questionIds={state.questionIds}
              questionScores={state.questionScores}
              bank={questions}
              onChange={({ questionIds, questionScores }) =>
                setState((s) => ({ ...s, questionIds, questionScores }))
              }
              onBankChange={setQuestions}
            />
          </FormSection>
          <FormSection title={t("admin.examWizard.questions.totalScore")}>
            <FieldRow>
              <Field>
                <div className="flex items-center justify-between">
                  <Label htmlFor="wiz-totalScore">
                    {t("admin.examWizard.questions.totalScore")}
                  </Label>
                  {hasQuestions && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => {
                        if (manualTotalScore) {
                          setManualTotalScore(false);
                          if (computedTotal > 0) {
                            setState((s) => ({
                              ...s,
                              totalScore: computedTotal,
                            }));
                          }
                        } else {
                          setManualTotalScore(true);
                        }
                      }}
                    >
                      {manualTotalScore
                        ? t("admin.examWizard.questions.autoCalc")
                        : t("admin.examWizard.questions.manualInput")}
                    </Button>
                  )}
                </div>
                <Input
                  id="wiz-totalScore"
                  type="number"
                  min={1}
                  value={state.totalScore}
                  readOnly={hasQuestions && !manualTotalScore}
                  aria-label={t("admin.examWizard.questions.totalScore")}
                  onChange={(e) => {
                    // Empty input keeps the previous value — never store 0.
                    if (e.target.value === "") return;
                    setState((s) => ({
                      ...s,
                      totalScore: Number(e.target.value),
                    }));
                  }}
                />
                {hasQuestions && !manualTotalScore && (
                  <p className="type-metadata">
                    {t("admin.examWizard.questions.autoCalcLabel", {
                      score: computedTotal,
                    })}
                  </p>
                )}
                {hasQuestions &&
                  manualTotalScore &&
                  state.totalScore !== computedTotal && (
                    <p className="text-xs text-destructive">
                      {t("admin.examWizard.questions.scoreMismatch", {
                        score: computedTotal,
                      })}
                    </p>
                  )}
              </Field>
              <Field>
                <Label htmlFor="wiz-passingScore">
                  {t("admin.examWizard.questions.passingScore")}
                </Label>
                <Input
                  id="wiz-passingScore"
                  data-testid="passingScore-input"
                  type="number"
                  min={0}
                  value={state.passingScore}
                  onChange={(e) => {
                    // Empty input keeps the previous value — never store 0.
                    if (e.target.value === "") return;
                    setPassingScoreTouched(true);
                    setState((s) => ({
                      ...s,
                      passingScore: Number(e.target.value),
                    }));
                  }}
                />
                {fieldErrors.score && (
                  <FieldError>{fieldErrors.score}</FieldError>
                )}
              </Field>
            </FieldRow>
          </FormSection>
        </FieldGroup>
      )}

      {/* Step 4 — schedule */}
      {state.step === 4 && (
        <FormSection title={t("admin.examWizard.steps.schedule")}>
          <FieldRow>
            <Field>
              <Label htmlFor="wiz-openAt">
                {t("admin.examWizard.schedule.startTime")}
              </Label>
              <Input
                id="wiz-openAt"
                type="datetime-local"
                value={state.openAt}
                onChange={(e) =>
                  setState((s) => ({ ...s, openAt: e.target.value }))
                }
              />
            </Field>
            {/* Untimed (Phase A2 (Issue 291)) is open-ended — no close time to pick. */}
            {preview.resolved.timingMode !== "untimed" && (
              <Field>
                <Label htmlFor="wiz-closeAt">
                  {t("admin.examWizard.schedule.endTime")}
                </Label>
                <Input
                  id="wiz-closeAt"
                  type="datetime-local"
                  value={state.closeAt}
                  onChange={(e) =>
                    setState((s) => ({ ...s, closeAt: e.target.value }))
                  }
                />
              </Field>
            )}
            {preview.resolved.timingMode === "untimed" && (
              <p className="type-secondary">
                {t("admin.examWizard.schedule.untimedHint")}
              </p>
            )}
          </FieldRow>
          {/* Local validation key + server-routed field names both render. */}
          <FieldError>{fieldErrors.time}</FieldError>
          <FieldError>{fieldErrors.openAt}</FieldError>
          <FieldError>{fieldErrors.closeAt}</FieldError>
        </FormSection>
      )}

      {/* Step 5 — review */}
      {state.step === 5 && (
        <FieldGroup>
          <FormSection title={t("admin.examWizard.review.title")}>
            <div>
              <h3 className="type-section-title">
                {t("admin.examWizard.review.summaryHeading")}
              </h3>
              <p className="mt-1 type-secondary">
                {summarizeProfile(preview.resolved, summaryLabels)}
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="type-section-title">
                {t("admin.examWizard.review.basicHeading")}
              </h3>
              <DefinitionList
                className="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2"
                items={[
                  {
                    label: t("admin.examWizard.fields.title"),
                    value: state.title || "—",
                  },
                  {
                    label: t("admin.examWizard.fields.course"),
                    value:
                      courses.find((c) => c.id === state.courseId)?.name ?? "—",
                  },
                ]}
              />
            </div>
            <Separator />
            <div>
              <h3 className="type-section-title">
                {t("admin.examWizard.review.scheduleHeading")}
              </h3>
              <DefinitionList
                className="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2"
                items={[
                  {
                    label: t("admin.examWizard.schedule.startTime"),
                    value: state.openAt ? formatDateTime(state.openAt) : "—",
                  },
                  {
                    label: t("admin.examWizard.schedule.endTime"),
                    value: state.closeAt ? formatDateTime(state.closeAt) : "—",
                  },
                ]}
              />
            </div>
            <Separator />
            <div>
              <h3 className="type-section-title">
                {t("admin.examWizard.review.scoringHeading")}
              </h3>
              <DefinitionList
                className="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2"
                items={[
                  {
                    label: t("admin.examWizard.questions.totalScore"),
                    value: state.totalScore,
                  },
                  {
                    label: t("admin.examWizard.questions.passingScore"),
                    value: state.passingScore,
                  },
                  ...(hasQuestions && state.totalScore !== computedTotal
                    ? [
                        {
                          label: (
                            <span className="text-destructive">
                              {t("admin.examWizard.review.warningsHeading")}
                            </span>
                          ),
                          value: (
                            <span className="text-destructive">
                              {t(
                                "admin.examWizard.review.scoreMismatchWarning",
                                {
                                  score: computedTotal,
                                },
                              )}
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <Separator />
            <div>
              <h3 className="type-section-title">
                {t("admin.examWizard.review.questionsHeading")}
              </h3>
              <p className="mt-1 text-sm">
                {state.questionIds.length === 0
                  ? t("admin.examWizard.review.noQuestionsWarning")
                  : t("admin.examWizard.questions.selectedCount", {
                      count: state.questionIds.length,
                    })}
              </p>
            </div>
          </FormSection>
        </FieldGroup>
      )}

      {/* Save errors render on every step (server routing may land anywhere). */}
      {saveError && <InlineErrorBanner>{saveError}</InlineErrorBanner>}

      {/* Navigation */}
      <Separator />
      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() =>
            void navigate(
              resolveListReturnPath(location.state, routes.admin.exams),
            )
          }
        >
          {t("admin.examWizard.actions.cancel")}
        </Button>
        <div className="flex gap-3">
          {state.step > 1 && (
            <Button variant="outline" onClick={prev}>
              {t("admin.examWizard.prev")}
            </Button>
          )}
          {state.step < WIZARD_TOTAL_STEPS && (
            <Button onClick={next}>{t("admin.examWizard.next")}</Button>
          )}
          {state.step === WIZARD_TOTAL_STEPS && (
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving
                ? t("admin.examWizard.actions.creating")
                : t("admin.examWizard.actions.createDraft")}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nueva materia</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="new-subject-name">Nombre</Label>
              <Input
                id="new-subject-name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => void saveSubject()}
              disabled={savingSubject || !subjectName.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nueva comisión</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="new-commission-name">Nombre</Label>
              <Input
                id="new-commission-name"
                value={commissionName}
                onChange={(event) => setCommissionName(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="new-commission-subject">Materia</Label>
              <Select
                value={commissionSubjectId}
                onValueChange={setCommissionSubjectId}
              >
                <SelectTrigger
                  id="new-commission-subject"
                  aria-label="Materia de la comisión"
                >
                  <SelectValue placeholder="Elegí una materia" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => void saveCommission()}
              disabled={
                savingCommission ||
                !commissionName.trim() ||
                !commissionSubjectId
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
