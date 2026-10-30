import { useCallback, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/apiErrors";
import { getTypeLabel } from "@/lib/constants";
import type { PickerQuestion } from "@/lib/allQuestions";
import { AppIcon } from "@/components/shared/AppIcon";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineErrorBanner } from "@/components/shared/InlineErrorBanner";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  DataTableCell,
  DataTableHead,
  DataTableOverflowText,
  DataTableSurface,
} from "@/components/shared/DataTableContract";
import { TableAllocationRegion } from "@/components/shared/TableScrollSurface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { QuestionDTO } from "@exam/contracts";
import { cn } from "@/lib/utils";

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export interface ExamQuestionsEditorProps {
  questionIds: string[];
  questionScores: Record<string, number>;
  bank: PickerQuestion[];
  onChange: (next: {
    questionIds: string[];
    questionScores: Record<string, number>;
  }) => void;
  onBankChange: (bank: PickerQuestion[]) => void;
  readOnly?: boolean;
}

interface EditingState {
  key: string;
  questionId: string | null;
  data: QuestionFormData;
}

function truncateContent(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function bankEntryFromQuestion(
  q: QuestionDTO | PickerQuestion,
): PickerQuestion {
  return { id: q.id, type: q.type, content: q.content };
}

export function ExamQuestionsEditor({
  questionIds,
  questionScores,
  bank,
  onChange,
  onBankChange,
  readOnly = false,
}: ExamQuestionsEditorProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [createdHere, setCreatedHere] = useState<Set<string>>(() => new Set());
  const [loadingQuestionId, setLoadingQuestionId] = useState<string | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [sharedSave, setSharedSave] = useState<{
    questionId: string;
    payload: ReturnType<typeof buildQuestionPayload>;
  } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const createdHereRef = useRef(createdHere);
  createdHereRef.current = createdHere;

  const bankById = useCallback(
    () => new Map(bank.map((q) => [q.id, q])),
    [bank],
  );

  function applySelection(
    nextIds: string[],
    nextScores: Record<string, number>,
  ) {
    onChange({ questionIds: nextIds, questionScores: nextScores });
  }

  function upsertBank(entry: PickerQuestion) {
    if (bank.some((q) => q.id === entry.id)) {
      onBankChange(bank.map((q) => (q.id === entry.id ? entry : q)));
    } else {
      onBankChange([...bank, entry]);
    }
  }

  function addFromBank(qId: string) {
    if (questionIds.includes(qId)) return;
    applySelection([...questionIds, qId], {
      ...questionScores,
      [qId]: questionScores[qId] ?? 1,
    });
  }

  function removeFromExam(qId: string) {
    applySelection(
      questionIds.filter((id) => id !== qId),
      questionScores,
    );
  }

  function setScore(qId: string, score: number) {
    applySelection(questionIds, {
      ...questionScores,
      [qId]: score,
    });
  }

  function moveQuestion(from: number, to: number) {
    applySelection(moveItem(questionIds, from, to), questionScores);
  }

  function startNewQuestion() {
    if (readOnly) return;
    setSaveError(null);
    setEditing({
      key: `new-${crypto.randomUUID()}`,
      questionId: null,
      data: emptyQuestionFormData(),
    });
  }

  async function startEditQuestion(questionId: string) {
    if (readOnly || editing?.questionId === questionId) return;
    setSaveError(null);
    setLoadingQuestionId(questionId);
    try {
      const q = await api.get<QuestionDTO>(`/api/questions/${questionId}`);
      setEditing({
        key: questionId,
        questionId,
        data: questionToFormData(q),
      });
    } catch (err) {
      setSaveError(
        getApiErrorMessage(err, t, t("admin.examQuestionsEditor.loadFailed")),
      );
    } finally {
      setLoadingQuestionId(null);
    }
  }

  function cancelEditing() {
    setEditing(null);
    setSaveError(null);
  }

  async function persistNewQuestion(
    data: QuestionFormData,
    insertIndex: number,
  ) {
    const created = await api.post<QuestionDTO>(
      "/api/questions",
      buildQuestionPayload(data),
    );
    const entry = bankEntryFromQuestion(created);
    upsertBank(entry);
    const nextIds = [...questionIds];
    nextIds.splice(insertIndex, 0, created.id);
    const nextScores = {
      ...questionScores,
      [created.id]: questionScores[created.id] ?? 1,
    };
    applySelection(nextIds, nextScores);
    setCreatedHere((prev) => new Set(prev).add(created.id));
    setEditing(null);
  }

  async function persistPatch(questionId: string, data: QuestionFormData) {
    const updated = await api.patch<QuestionDTO>(
      `/api/questions/${questionId}`,
      buildQuestionPayload(data),
    );
    upsertBank(bankEntryFromQuestion(updated));
    setEditing(null);
  }

  async function persistCopy(oldId: string, data: QuestionFormData) {
    const created = await api.post<QuestionDTO>(
      "/api/questions",
      buildQuestionPayload(data),
    );
    const idx = questionIds.indexOf(oldId);
    const nextIds = questionIds.map((id) => (id === oldId ? created.id : id));
    const nextScores = {
      ...questionScores,
      [created.id]: questionScores[oldId] ?? 1,
    };
    delete nextScores[oldId];
    applySelection(nextIds, nextScores);
    upsertBank(bankEntryFromQuestion(created));
    setCreatedHere((prev) => new Set(prev).add(created.id));
    setEditing(null);
  }

  async function handleSaveQuestion() {
    if (!editing || saving) return;
    setSaveError(null);
    const validationError = validateQuestionForm(editing.data, t);
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    const payload = buildQuestionPayload(editing.data);
    setSaving(true);
    try {
      if (editing.questionId === null) {
        await persistNewQuestion(editing.data, questionIds.length);
        return;
      }
      const qid = editing.questionId;
      if (createdHereRef.current.has(qid)) {
        await persistPatch(qid, editing.data);
        return;
      }
      setSharedSave({ questionId: qid, payload });
    } catch (err) {
      const fieldMessage = Object.values(getApiFieldErrors(err)).find(Boolean);
      setSaveError(
        fieldMessage ??
          getApiErrorMessage(err, t, t("admin.examQuestionsEditor.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmReplaceInBank() {
    if (!sharedSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await persistPatch(sharedSave.questionId, {
        ...editing!.data,
      });
      setSharedSave(null);
    } catch (err) {
      const fieldMessage = Object.values(getApiFieldErrors(err)).find(Boolean);
      setSaveError(
        fieldMessage ??
          getApiErrorMessage(err, t, t("admin.examQuestionsEditor.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmSaveAsCopy() {
    if (!sharedSave || !editing || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await persistCopy(sharedSave.questionId, editing.data);
      setSharedSave(null);
    } catch (err) {
      const fieldMessage = Object.values(getApiFieldErrors(err)).find(Boolean);
      setSaveError(
        fieldMessage ??
          getApiErrorMessage(err, t, t("admin.examQuestionsEditor.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  }

  const availableBank = bank.filter((q) => !questionIds.includes(q.id));
  const dragDisabled = readOnly || editing !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-secondary">
          {t("admin.examQuestionsEditor.selectedCount", {
            count: questionIds.length,
          })}
        </p>
        {!readOnly && (
          <p className="type-metadata max-w-prose">
            {t("admin.examQuestionsEditor.persistHint")}
          </p>
        )}
      </div>

      {questionIds.length === 0 && editing === null ? (
        <EmptyState
          icon={<AppIcon icon={BookOpen} size="state" />}
          title={t("admin.examQuestionsEditor.noQuestionsTitle")}
          description={t("admin.examQuestionsEditor.noQuestionsDescription")}
        />
      ) : null}

      <ul
        id={listId}
        className="flex flex-col gap-3"
        aria-label={t("admin.examQuestionsEditor.listLabel")}
      >
        {questionIds.map((qId, index) => {
          const meta = bankById().get(qId);
          const isOpen = editing?.questionId === qId;
          const isLoading = loadingQuestionId === qId;

          return (
            <li
              key={qId}
              className={cn(
                dragOver === index && dragFrom !== null && dragFrom !== index
                  ? "rounded-lg ring-2 ring-primary"
                  : undefined,
              )}
              onDragOver={(event) => {
                if (dragDisabled || dragFrom === null) return;
                event.preventDefault();
                setDragOver(index);
              }}
              onDragLeave={() => {
                if (dragOver === index) setDragOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFrom === null || dragDisabled) return;
                moveQuestion(dragFrom, index);
                setDragFrom(null);
                setDragOver(null);
              }}
            >
              <Card>
                {isOpen ? (
                  <>
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <span className="type-metadata">
                          {t("admin.examQuestionsEditor.questionNumber", {
                            n: index + 1,
                          })}
                        </span>
                        {meta && (
                          <Badge variant="outline">
                            {getTypeLabel(meta.type, t) ?? meta.type}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {isLoading ? (
                        <LoadingState />
                      ) : (
                        <>
                          {saveError && (
                            <InlineErrorBanner className="mb-4">
                              {saveError}
                            </InlineErrorBanner>
                          )}
                          <QuestionForm
                            key={editing!.key}
                            initial={editing!.data}
                            onChange={(data) =>
                              setEditing((prev) =>
                                prev ? { ...prev, data } : prev,
                              )
                            }
                          />
                        </>
                      )}
                    </CardContent>
                    {!readOnly && (
                      <CardFooter className="flex justify-end gap-2 border-t pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          {t("admin.examQuestionsEditor.cancel")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void handleSaveQuestion()}
                          disabled={saving || isLoading}
                        >
                          {saving
                            ? t("admin.examQuestionsEditor.saving")
                            : t("admin.examQuestionsEditor.saveQuestion")}
                        </Button>
                      </CardFooter>
                    )}
                  </>
                ) : (
                  <>
                    <CardHeader className="flex flex-row flex-wrap items-start gap-3 sm:items-center">
                      {!readOnly && (
                        <button
                          type="button"
                          className={cn(
                            "touch-none rounded-md p-1 text-muted-foreground hover:bg-muted",
                            dragDisabled
                              ? "cursor-not-allowed opacity-40"
                              : "cursor-grab active:cursor-grabbing",
                          )}
                          aria-label={t("admin.examQuestionsEditor.dragHandle")}
                          draggable={!dragDisabled}
                          // ponytail: native HTML5 drag does not work on touch
                          // screens; up/down buttons cover reorder there. If
                          // touch drag becomes a requirement, switch the grip
                          // handle to @dnd-kit/sortable.
                          onDragStart={() => setDragFrom(index)}
                          onDragEnd={() => {
                            setDragFrom(null);
                            setDragOver(null);
                          }}
                          disabled={dragDisabled}
                        >
                          <AppIcon icon={GripVertical} size="inline" />
                        </button>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="type-metadata">
                            {t("admin.examQuestionsEditor.questionNumber", {
                              n: index + 1,
                            })}
                          </span>
                          {meta && (
                            <Badge variant="outline">
                              {getTypeLabel(meta.type, t) ?? meta.type}
                            </Badge>
                          )}
                        </div>
                        <p className="type-secondary line-clamp-2">
                          {meta
                            ? truncateContent(meta.content)
                            : t("admin.examQuestionsEditor.missingQuestion")}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex flex-wrap items-center gap-2">
                          <LabelledScoreInput
                            label={t("admin.examQuestionsEditor.scoreLabel")}
                            value={questionScores[qId] ?? 1}
                            onChange={(value) => setScore(qId, value)}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={t("admin.examQuestionsEditor.edit")}
                            onClick={() => void startEditQuestion(qId)}
                            disabled={editing !== null}
                          >
                            <AppIcon icon={Pencil} size="inline" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={t("admin.examQuestionsEditor.moveUp")}
                            disabled={index === 0 || editing !== null}
                            onClick={() => moveQuestion(index, index - 1)}
                          >
                            <AppIcon icon={ChevronUp} size="inline" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={t("admin.examQuestionsEditor.moveDown")}
                            disabled={
                              index === questionIds.length - 1 ||
                              editing !== null
                            }
                            onClick={() => moveQuestion(index, index + 1)}
                          >
                            <AppIcon icon={ChevronDown} size="inline" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={t(
                              "admin.examQuestionsEditor.removeFromExam",
                            )}
                            onClick={() => setRemoveTarget(qId)}
                            disabled={editing !== null}
                          >
                            <AppIcon icon={Trash2} size="inline" />
                          </Button>
                        </div>
                      )}
                      {readOnly && (
                        <span className="type-metadata">
                          {t("admin.examQuestionsEditor.scoreReadOnly", {
                            score: questionScores[qId] ?? 1,
                          })}
                        </span>
                      )}
                    </CardHeader>
                  </>
                )}
              </Card>
            </li>
          );
        })}

        {editing?.questionId === null && (
          <li>
            <Card>
              <CardHeader className="border-b pb-4">
                <span className="type-metadata">
                  {t("admin.examQuestionsEditor.newQuestionTitle")}
                </span>
              </CardHeader>
              <CardContent className="pt-4">
                {saveError && (
                  <InlineErrorBanner className="mb-4">
                    {saveError}
                  </InlineErrorBanner>
                )}
                <QuestionForm
                  key={editing.key}
                  initial={editing.data}
                  onChange={(data) =>
                    setEditing((prev) => (prev ? { ...prev, data } : prev))
                  }
                />
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  {t("admin.examQuestionsEditor.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSaveQuestion()}
                  disabled={saving}
                >
                  {saving
                    ? t("admin.examQuestionsEditor.saving")
                    : t("admin.examQuestionsEditor.saveQuestion")}
                </Button>
              </CardFooter>
            </Card>
          </li>
        )}
      </ul>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={startNewQuestion}
            disabled={editing !== null}
          >
            <AppIcon icon={Plus} size="inline" className="mr-1" />
            {t("admin.examQuestionsEditor.newQuestion")}
          </Button>
          <Button
            type="button"
            onClick={() => setBankDialogOpen(true)}
            disabled={editing !== null}
          >
            {t("admin.examQuestionsEditor.addFromBank")}
          </Button>
        </div>
      )}

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          size="lg"
        >
          <DialogHeader>
            <DialogTitle>
              {t("admin.examQuestionsEditor.bankDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div data-slot="dialog-body">
            <TableAllocationRegion>
              <DataTableSurface
                columns={[
                  { role: "type" },
                  { role: "long-text", overflow: "truncate" },
                  { role: "actions" },
                ]}
              >
                <TableHeader>
                  <TableRow>
                    <DataTableHead role="type">
                      {t("admin.examQuestionsEditor.tableHeaders.type")}
                    </DataTableHead>
                    <DataTableHead role="long-text">
                      {t("admin.examQuestionsEditor.tableHeaders.content")}
                    </DataTableHead>
                    <DataTableHead role="actions">
                      {t("admin.examQuestionsEditor.dialogActions.add")}
                    </DataTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableBank.map((q) => (
                    <TableRow key={q.id}>
                      <DataTableCell role="type">
                        <Badge variant="outline">
                          {getTypeLabel(q.type, t) ?? q.type}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell role="long-text">
                        <DataTableOverflowText
                          mode="truncate"
                          value={q.content}
                        />
                      </DataTableCell>
                      <DataTableCell role="actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addFromBank(q.id)}
                        >
                          {t("admin.examQuestionsEditor.dialogActions.add")}
                        </Button>
                      </DataTableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTableSurface>
            </TableAllocationRegion>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              {t("admin.examQuestionsEditor.dialogActions.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.examQuestionsEditor.confirmRemoveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.examQuestionsEditor.confirmRemoveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("admin.examQuestionsEditor.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removeTarget) removeFromExam(removeTarget);
                setRemoveTarget(null);
              }}
            >
              {t("admin.examQuestionsEditor.confirmRemoveAction")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={sharedSave !== null}
        onOpenChange={(open) => {
          if (!open) setSharedSave(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.examQuestionsEditor.sharedSaveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.examQuestionsEditor.sharedSaveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={saving}>
              {t("admin.examQuestionsEditor.cancel")}
            </AlertDialogCancel>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void confirmSaveAsCopy()}
            >
              {t("admin.examQuestionsEditor.saveAsCopy")}
            </Button>
            <Button
              disabled={saving}
              onClick={() => void confirmReplaceInBank()}
            >
              {t("admin.examQuestionsEditor.replaceInBank")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LabelledScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={1}
      className="h-8 w-20"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
