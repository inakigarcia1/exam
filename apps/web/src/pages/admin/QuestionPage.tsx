import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { ContentDocumentV1 } from "@exam/domain";
import { ApiError, api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataToolbar, ToolbarFilter } from "@/components/shared/DataToolbar";
import { DataViewSearch } from "@/components/shared/DataViewSearch";
import { RowActions } from "@/components/shared/RowActions";
import { AppIcon } from "@/components/shared/AppIcon";
import { TagFilterSelect } from "@/components/shared/TagFilterSelect";
import { TagBadge } from "@/components/shared/TagBadge";
import { PageContainer } from "@/components/shared/PageContainer";
import { ContentDocumentRenderer } from "@/components/shared/content/ContentDocumentRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getTypeLabel,
  isQuestionType,
  QUESTION_TYPE_LABEL_KEYS,
  TYPE_VARIANT,
} from "@/lib/constants";
import { formatStandardAnswerForDisplay } from "@/lib/answerDisplay";
import { listReturnState } from "@/lib/listReturnNavigation";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Download,
  FileUp,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

/** A question as returned by the question list API. */
interface QuestionRow {
  id: string;
  type: string;
  content: string;
  contentDocument?: ContentDocumentV1 | null;
  options?: Array<{
    id: string;
    content: string;
    contentDocument?: ContentDocumentV1 | null;
  }>;
  standardAnswer?: unknown;
  difficulty: number;
  tags: string[];
  createdAt?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The API's maximum page size; the page reads every page of the filter. */
const FETCH_PAGE_SIZE = 100;

/** Select value for "no filter" — the parameter-less default of every control. */
const ALL = "all";

const DIFFICULTY_VALUES = ["1", "2", "3", "4", "5"];

/** URL parameters this page owns; every other parameter is passed through. */
const MANAGED_PARAMS = ["type", "difficulty", "tags", "search"] as const;

type ManagedParam = (typeof MANAGED_PARAMS)[number];

function isManagedParam(key: string): key is ManagedParam {
  return (MANAGED_PARAMS as readonly string[]).includes(key);
}

/** Canonical tag selection: trimmed, de-duplicated, sorted. */
function normalizeTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of raw.split(",")) {
    const tag = token.trim();
    if (tag) seen.add(tag);
  }
  // Default (UTF-16 code unit) sort on purpose: the canonical form must be the
  // same string on every client, so it cannot depend on the locale.
  return [...seen].sort();
}

/**
 * The canonical value of a managed parameter, or null when the parameter must
 * be absent. This is the ONE place the page decides what a URL value means;
 * both the request builder and the canonical rewrite read it.
 */
function canonicalParamValue(key: ManagedParam, raw: string): string | null {
  switch (key) {
    case "type":
      return isQuestionType(raw) ? raw : null;
    case "difficulty":
      return DIFFICULTY_VALUES.includes(raw) ? raw : null;
    case "tags": {
      const tags = normalizeTags(raw);
      return tags.length === 0 ? null : tags.join(",");
    }
    case "search":
      return raw.trim() === "" ? null : raw.trim();
  }
}

/**
 * The canonical parameter list for `params`, or null when it already is
 * canonical. Unmanaged parameters are preserved untouched; a repeated managed
 * parameter keeps its FIRST value and drops the rest. The retired `courseId`
 * and `page` parameters are dropped. Idempotent by construction.
 */
function canonicalizeParams(params: URLSearchParams): URLSearchParams | null {
  const next = new URLSearchParams();
  const emitted = new Set<string>();
  for (const [key, value] of params) {
    if (key === "courseId" || key === "page") continue;
    if (!isManagedParam(key)) {
      next.append(key, value);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    const canonical = canonicalParamValue(key, value);
    if (canonical !== null) next.set(key, canonical);
  }
  return next.toString() === params.toString() ? null : next;
}

const GROUP_BY_VALUES = ["tag", "type", "difficulty", "none"] as const;
const SORT_BY_VALUES = ["newest", "oldest", "content", "difficulty"] as const;
const LAYOUT_VALUES = ["grid", "list"] as const;

/** How the user wants the bank laid out; kept per browser. */
interface ViewPrefs {
  groupBy: (typeof GROUP_BY_VALUES)[number];
  sortBy: (typeof SORT_BY_VALUES)[number];
  layout: (typeof LAYOUT_VALUES)[number];
  showAnswers: boolean;
}

const DEFAULT_PREFS: ViewPrefs = {
  groupBy: "tag",
  sortBy: "newest",
  layout: "grid",
  showAnswers: false,
};

export const QUESTION_VIEW_PREFS_KEY = "aki.questions.view";

function pick<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readPrefs(): ViewPrefs {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(QUESTION_VIEW_PREFS_KEY) ?? "{}",
    );
    const stored = (raw ?? {}) as Record<string, unknown>;
    return {
      groupBy: pick(GROUP_BY_VALUES, stored.groupBy, DEFAULT_PREFS.groupBy),
      sortBy: pick(SORT_BY_VALUES, stored.sortBy, DEFAULT_PREFS.sortBy),
      layout: pick(LAYOUT_VALUES, stored.layout, DEFAULT_PREFS.layout),
      showAnswers:
        typeof stored.showAnswers === "boolean"
          ? stored.showAnswers
          : DEFAULT_PREFS.showAnswers,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface QuestionGroup {
  key: string;
  label: string;
  questions: QuestionRow[];
}

const UNTAGGED = "\u0000untagged";

function sortQuestions(
  questions: QuestionRow[],
  sortBy: ViewPrefs["sortBy"],
): QuestionRow[] {
  const byContent = (a: QuestionRow, b: QuestionRow) =>
    a.content.localeCompare(b.content, "es", { sensitivity: "base" });
  const byCreated = (a: QuestionRow, b: QuestionRow) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  const sorted = [...questions];
  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => byCreated(b, a));
    case "oldest":
      return sorted.sort(byCreated);
    case "content":
      return sorted.sort(byContent);
    case "difficulty":
      return sorted.sort(
        (a, b) => a.difficulty - b.difficulty || byContent(a, b),
      );
  }
}

/**
 * Splits the questions into the groups the user chose. A question with
 * several tags appears under each of them; while a tag filter is active only
 * the filtered tags become groups.
 */
function groupQuestions(
  questions: QuestionRow[],
  prefs: ViewPrefs,
  selectedTags: string[],
  t: TFunction,
): QuestionGroup[] {
  const buckets = new Map<string, QuestionRow[]>();
  const add = (key: string, question: QuestionRow) => {
    const bucket = buckets.get(key);
    if (bucket) bucket.push(question);
    else buckets.set(key, [question]);
  };
  for (const question of questions) {
    switch (prefs.groupBy) {
      case "tag": {
        const tags =
          selectedTags.length > 0
            ? question.tags.filter((tag) => selectedTags.includes(tag))
            : question.tags;
        if (tags.length === 0) add(UNTAGGED, question);
        for (const tag of tags) add(tag, question);
        break;
      }
      case "type":
        add(question.type, question);
        break;
      case "difficulty":
        add(String(question.difficulty), question);
        break;
      case "none":
        add("all", question);
        break;
    }
  }

  const label = (key: string): string => {
    switch (prefs.groupBy) {
      case "tag":
        return key === UNTAGGED ? t("admin.questions.view.untagged") : key;
      case "type":
        return getTypeLabel(key, t) ?? key;
      case "difficulty":
        return t("admin.questions.difficultyLabel", { value: Number(key) });
      case "none":
        return "";
    }
  };
  const typeOrder = Object.keys(QUESTION_TYPE_LABEL_KEYS);
  const rank = (key: string): number => {
    if (prefs.groupBy === "type") return typeOrder.indexOf(key);
    if (prefs.groupBy === "difficulty") return Number(key);
    return key === UNTAGGED ? 1 : 0;
  };

  return [...buckets.entries()]
    .map(([key, items]) => ({
      key,
      label: label(key),
      questions: sortQuestions(items, prefs.sortBy),
    }))
    .sort(
      (a, b) =>
        rank(a.key) - rank(b.key) ||
        a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
    );
}

/** Option ids named by a choice question's stored answer. */
function correctOptionIds(answer: unknown): string[] {
  if (answer == null) return [];
  if (Array.isArray(answer)) return answer.map(String);
  return [String(answer)];
}

const QUESTION_CSV_HEADER =
  "Tipo,Enunciado,OpciónA,OpciónB,OpciónC,OpciónD,Respuesta correcta,Dificultad,Etiqueta";

function downloadQuestionTemplate() {
  const blob = new Blob([`${QUESTION_CSV_HEADER}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla-preguntas.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseQuestionCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseQuestionCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseQuestionCsvLine(line);
    if (cols.length < 2) continue;
    const type = cols[0] ?? "";
    const answer = cols[6] ?? "";
    rows.push({
      type,
      content: cols[1] ?? "",
      optionA: cols[2] || undefined,
      optionB: cols[3] || undefined,
      optionC: cols[4] || undefined,
      optionD: cols[5] || undefined,
      standardAnswer:
        type === "true_false"
          ? answer.toLowerCase() === "true" || answer === "Sí"
          : type === "multiple_choice"
            ? answer
                .split(/[|,]/)
                .map((item) => item.trim())
                .filter(Boolean)
            : answer,
      difficulty: cols[7] ? Number(cols[7]) : undefined,
      tags: cols[8] || undefined,
    });
  }
  return rows;
}

function QuestionCard({
  question,
  showAnswers,
  onDelete,
}: {
  question: QuestionRow;
  showAnswers: boolean;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const editPath = `/admin/questions/${question.id}/edit`;
  const options = question.options ?? [];
  const correctIds = correctOptionIds(question.standardAnswer);

  return (
    <Card data-testid={`question-card-${question.id}`} className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant={TYPE_VARIANT[question.type] ?? "default"}
              className="h-auto whitespace-normal"
            >
              {getTypeLabel(question.type, t) ?? question.type}
            </Badge>
            <Badge variant="outline" className="h-auto whitespace-normal">
              {t("admin.questions.difficultyLabel", {
                value: question.difficulty,
              })}
            </Badge>
          </div>
          <RowActions
            row={question}
            actions={[
              {
                id: "edit",
                label: t("admin.questions.editLabel"),
                icon: Pencil,
                onSelect: () =>
                  void navigate(editPath, {
                    state: listReturnState(location),
                  }),
              },
              {
                id: "delete",
                label: t("admin.questions.deleteLabel"),
                icon: Trash2,
                tone: "destructive",
                confirm: {
                  title: t("admin.questions.confirmDelete"),
                  description: t("admin.questions.confirmDeleteDescription"),
                  destructive: true,
                },
                onSelect: () => onDelete(question.id),
              },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Link
          to={editPath}
          state={listReturnState(location)}
          className="block cursor-pointer break-words underline-offset-2 hover:underline"
        >
          {question.contentDocument ? (
            <ContentDocumentRenderer document={question.contentDocument} />
          ) : (
            <p className="whitespace-pre-wrap">{question.content}</p>
          )}
        </Link>

        {showAnswers &&
          (options.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {options.map((option) => {
                const correct = correctIds.includes(option.id);
                return (
                  <li
                    key={option.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 break-words",
                      correct && "border-success",
                    )}
                  >
                    {correct && (
                      <AppIcon
                        icon={CircleCheck}
                        decorative={false}
                        label={t("admin.questions.view.correctOption")}
                        size="badge"
                        className="shrink-0 text-success"
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
                  </li>
                );
              })}
            </ul>
          ) : question.standardAnswer != null ? (
            <div className="flex flex-col gap-1">
              <span className="type-secondary">
                {t("admin.questions.view.answer")}
              </span>
              <p className="break-words whitespace-pre-wrap">
                {formatStandardAnswerForDisplay(
                  question.standardAnswer,
                  question.type,
                )}
              </p>
            </div>
          ) : null)}

        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {question.tags.map((tag) => (
              <TagBadge key={tag}>{tag}</TagBadge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Question bank as cards grouped by tag (or type, difficulty, nothing),
 * sorted and laid out as the user prefers. Server-side filters stay in the
 * URL; the view preferences stay in this browser.
 */
export function QuestionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [tagVocabulary, setTagVocabulary] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<ViewPrefs>(readPrefs);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // `key` is the filter identity the state belongs to; rows of another
  // identity are never shown as the answer to the current one.
  const [loadState, setLoadState] = useState<{
    key: string | null;
    status: "loading" | "loaded" | "failed";
  }>({ key: null, status: "loading" });
  // Overlapping filter changes fire overlapping requests; only the latest
  // generation may write state.
  const requestGenerationRef = useRef(0);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? "",
  );
  const lastCommittedSearch = useRef(searchInput);

  const typeRaw = searchParams.get("type") ?? "";
  const difficultyRaw = searchParams.get("difficulty") ?? "";
  const tagsRaw = searchParams.get("tags") ?? "";
  const searchRaw = searchParams.get("search") ?? "";

  const filterType = canonicalParamValue("type", typeRaw) ?? "";
  const filterDifficulty =
    canonicalParamValue("difficulty", difficultyRaw) ?? "";
  const tagsKey = canonicalParamValue("tags", tagsRaw) ?? "";
  const search = canonicalParamValue("search", searchRaw) ?? "";
  const tags = useMemo(() => (tagsKey ? tagsKey.split(",") : []), [tagsKey]);
  const filterKey = JSON.stringify([
    filterType,
    filterDifficulty,
    tagsKey,
    search,
  ]);

  useEffect(() => {
    localStorage.setItem(QUESTION_VIEW_PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Canonicalization is a visible correction, so it REPLACES the entry.
  useEffect(() => {
    const canonical = canonicalizeParams(searchParams);
    if (canonical) setSearchParams(canonical, { replace: true });
  }, [searchParams, setSearchParams]);

  // URL -> draft, only while the user has not typed past the last committed
  // value (Back/Forward, a shared link).
  useEffect(() => {
    if (searchInput === lastCommittedSearch.current) setSearchInput(search);
    lastCommittedSearch.current = search;
  }, [search, searchInput]);

  const loadTagVocabulary = useCallback(async () => {
    try {
      const data = await api.get<{ tags: string[] }>("/api/questions/tags");
      setTagVocabulary(data.tags);
    } catch {
      // vocabulary is optional context — the filter still renders (empty)
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    const generation = ++requestGenerationRef.current;
    const isStale = () => generation !== requestGenerationRef.current;
    setLoadState({ key: filterKey, status: "loading" });
    try {
      const all: QuestionRow[] = [];
      // ponytail: reads the whole filtered bank (100 per request); add
      // server-side grouping if banks grow into the tens of thousands.
      for (let page = 1, totalPages = 1; page <= totalPages; page++) {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(FETCH_PAGE_SIZE));
        if (filterType !== "") params.set("type", filterType);
        if (filterDifficulty !== "") params.set("difficulty", filterDifficulty);
        if (tagsKey !== "") params.set("tags", tagsKey);
        if (search !== "") params.set("search", search);
        const data = await api.get<PaginatedResponse<QuestionRow>>(
          `/api/questions?${params.toString()}`,
        );
        if (isStale()) return;
        all.push(...data.items);
        totalPages = data.totalPages;
      }
      setQuestions(all);
      setLoadState({ key: filterKey, status: "loaded" });
    } catch {
      if (isStale()) return;
      setLoadState({ key: filterKey, status: "failed" });
    }
  }, [filterDifficulty, filterKey, filterType, search, tagsKey]);

  useEffect(() => {
    void loadTagVocabulary();
  }, [loadTagVocabulary]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  // A delete confirmation can land after the user changed the filters; the
  // refetch must target the query on screen NOW.
  const loadQuestionsRef = useRef(loadQuestions);
  useEffect(() => {
    loadQuestionsRef.current = loadQuestions;
  }, [loadQuestions]);

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/questions/${id}`);
      await Promise.all([loadQuestionsRef.current(), loadTagVocabulary()]);
    } catch {
      toast.error(t("admin.questions.toast.deleteFailed"));
    }
  }

  function commitFilters(patch: {
    type?: string;
    difficulty?: string;
    tags?: string[];
    search?: string;
  }) {
    const next = new URLSearchParams(searchParams);
    if (patch.type !== undefined) {
      if (patch.type === "") next.delete("type");
      else next.set("type", patch.type);
    }
    if (patch.difficulty !== undefined) {
      if (patch.difficulty === "") next.delete("difficulty");
      else next.set("difficulty", patch.difficulty);
    }
    if (patch.tags !== undefined) {
      if (patch.tags.length === 0) next.delete("tags");
      else next.set("tags", normalizeTags(patch.tags.join(",")).join(","));
    }
    if (patch.search !== undefined) {
      const term = patch.search.trim();
      if (term === "") next.delete("search");
      else next.set("search", term);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }

  function clearFilters() {
    setSearchInput("");
    lastCommittedSearch.current = "";
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function updatePrefs(patch: Partial<ViewPrefs>) {
    setPrefs((current) => ({ ...current, ...patch }));
    if (patch.groupBy !== undefined) setCollapsed(new Set());
  }

  function toggleGroup(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hasActiveFilter =
    filterType !== "" ||
    filterDifficulty !== "" ||
    tags.length > 0 ||
    search !== "";
  const settled = loadState.key === filterKey;
  const isLoading = !settled || loadState.status === "loading";
  const failed = settled && loadState.status === "failed";

  const groups = useMemo(
    () => groupQuestions(questions, prefs, tags, t),
    [questions, prefs, tags, t],
  );

  let body;
  if (isLoading) {
    body = <LoadingState />;
  } else if (failed) {
    body = (
      <ErrorState
        message={t("admin.common.loadFailed")}
        onRetry={() => void loadQuestionsRef.current()}
      />
    );
  } else if (questions.length === 0) {
    body = (
      <EmptyState
        icon={<AppIcon icon={CircleHelp} size="state" />}
        title={
          hasActiveFilter
            ? t("admin.questions.noMatch")
            : t("admin.questions.empty")
        }
        description={
          hasActiveFilter
            ? t("admin.questions.noMatchDescription")
            : t("admin.questions.emptyDescription")
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <p className="type-secondary" aria-live="polite">
          {t("admin.questions.view.count", { count: questions.length })}
        </p>
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const cards = (
            <div
              className={
                prefs.layout === "grid"
                  ? "grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3"
                  : "flex flex-col gap-4"
              }
            >
              {group.questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  showAnswers={prefs.showAnswers}
                  onDelete={(id) => void handleDelete(id)}
                />
              ))}
            </div>
          );
          if (prefs.groupBy === "none") {
            return <div key={group.key}>{cards}</div>;
          }
          return (
            <section
              key={group.key}
              data-testid={`question-group-${group.key}`}
              className="flex flex-col gap-3"
            >
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.key)}
                className="flex cursor-pointer items-center gap-2 self-start text-left"
              >
                <AppIcon
                  icon={isCollapsed ? ChevronRight : ChevronDown}
                  size="inline"
                />
                <h2 className="type-section-title break-words">
                  {group.label}
                </h2>
                <span className="type-secondary">{group.questions.length}</span>
              </button>
              {!isCollapsed && cards}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <PageContainer role="admin-dense" className="flex flex-col gap-6">
      <PageHeader
        title={t("admin.questions.title")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadQuestionTemplate}>
              <AppIcon icon={Download} size="inline" />
              Descargar plantilla
            </Button>
            <Button
              variant="outline"
              onClick={() => csvInputRef.current?.click()}
            >
              <AppIcon icon={FileUp} size="inline" />
              Subir CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void (async () => {
                  try {
                    const rows = parseQuestionCsv(await file.text());
                    if (rows.length === 0) {
                      toast.error("El CSV no tiene filas para importar");
                      return;
                    }
                    const result = await api.post<{
                      errors: number;
                      valid: number;
                    }>("/api/questions/import", { rows, confirm: true });
                    if (result.errors > 0) {
                      toast.error(
                        `${result.errors} filas no se pudieron importar`,
                      );
                    } else {
                      toast.success("Preguntas importadas");
                    }
                    await Promise.all([
                      loadQuestionsRef.current(),
                      loadTagVocabulary(),
                    ]);
                  } catch (err) {
                    toast.error(
                      err instanceof ApiError
                        ? err.message
                        : "No se pudo importar el CSV",
                    );
                  }
                })();
              }}
            />
            <Button
              onClick={() =>
                void navigate("/admin/questions/new", {
                  state: listReturnState(location),
                })
              }
            >
              <AppIcon icon={Plus} size="inline" />
              {t("admin.questions.createBtn")}
            </Button>
          </div>
        }
      />

      <DataToolbar
        aria-label={t("admin.questions.filterToolbar")}
        search={
          <DataViewSearch
            aria-label={t("admin.questions.searchLabel")}
            placeholder={t("admin.questions.searchPlaceholder")}
            value={searchInput}
            onChange={setSearchInput}
            onSearch={(term) => commitFilters({ search: term })}
            loading={isLoading}
          />
        }
        actions={
          <>
            <span
              className={`inline-flex min-w-[5.5rem] items-center gap-2 type-secondary ${
                isLoading ? "visible" : "invisible"
              }`}
              aria-live="polite"
              aria-hidden={!isLoading}
            >
              <AppIcon
                icon={LoaderCircle}
                size="inline"
                className="animate-spin"
              />
              {t("common.loading")}
            </span>
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                aria-label={t("admin.common.clearFilter")}
              >
                <AppIcon icon={RotateCcw} size="inline" />
                {t("admin.questions.clearFilter")}
              </Button>
            )}
          </>
        }
      >
        <Select
          value={filterType === "" ? ALL : filterType}
          onValueChange={(value) =>
            commitFilters({ type: value === ALL ? "" : value })
          }
        >
          <ToolbarFilter size="narrow">
            <SelectTrigger aria-label={t("admin.questions.filterType")}>
              <SelectValue placeholder={t("admin.questions.filterType")} />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            <SelectItem value={ALL}>
              {t("admin.questions.filterAllTypes")}
            </SelectItem>
            {Object.keys(QUESTION_TYPE_LABEL_KEYS).map((type) => (
              <SelectItem key={type} value={type}>
                {getTypeLabel(type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterDifficulty === "" ? ALL : filterDifficulty}
          onValueChange={(value) =>
            commitFilters({ difficulty: value === ALL ? "" : value })
          }
        >
          <ToolbarFilter size="narrow">
            <SelectTrigger aria-label={t("admin.questions.filterDifficulty")}>
              <SelectValue
                placeholder={t("admin.questions.filterDifficulty")}
              />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            <SelectItem value={ALL}>
              {t("admin.questions.filterAllDifficulties")}
            </SelectItem>
            {DIFFICULTY_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t("admin.questions.difficultyLabel", {
                  value: Number(value),
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToolbarFilter size="wide">
          <TagFilterSelect
            tags={tagVocabulary}
            selected={tags}
            onChange={(next) => commitFilters({ tags: next })}
            aria-label={t("admin.questions.tagFilterLabel")}
          />
        </ToolbarFilter>
      </DataToolbar>

      <div
        role="group"
        aria-label={t("admin.questions.view.label")}
        className="flex flex-wrap items-center gap-4"
      >
        <Select
          value={prefs.groupBy}
          onValueChange={(value) =>
            updatePrefs({ groupBy: pick(GROUP_BY_VALUES, value, "tag") })
          }
        >
          <ToolbarFilter size="narrow">
            <SelectTrigger aria-label={t("admin.questions.view.groupBy")}>
              <SelectValue />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            {GROUP_BY_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`admin.questions.view.groupByOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={prefs.sortBy}
          onValueChange={(value) =>
            updatePrefs({ sortBy: pick(SORT_BY_VALUES, value, "newest") })
          }
        >
          <ToolbarFilter size="narrow">
            <SelectTrigger aria-label={t("admin.questions.view.sortBy")}>
              <SelectValue />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            {SORT_BY_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`admin.questions.view.sortByOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={prefs.layout}
          onValueChange={(value) =>
            updatePrefs({ layout: pick(LAYOUT_VALUES, value, "grid") })
          }
        >
          <ToolbarFilter size="narrow">
            <SelectTrigger aria-label={t("admin.questions.view.layout")}>
              <SelectValue />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            {LAYOUT_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`admin.questions.view.layoutOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="question-show-answers"
            checked={prefs.showAnswers}
            onCheckedChange={(checked) => updatePrefs({ showAnswers: checked })}
          />
          <Label htmlFor="question-show-answers">
            {t("admin.questions.view.showAnswers")}
          </Label>
        </div>
      </div>

      {body}
    </PageContainer>
  );
}
