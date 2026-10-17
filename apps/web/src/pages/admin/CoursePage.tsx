import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/AppIcon";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldGroup, Field } from "@/components/shared/FieldGroup";
import { RowActions } from "@/components/shared/RowActions";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { DataViewFooter } from "@/components/shared/DataViewFooter";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { DataTableOverflowText } from "@/components/shared/DataTableContract";
import {
  DesktopDataTable,
  type DataViewColumnDef,
} from "@/components/shared/DesktopDataTable";
import { MobileRecordList } from "@/components/shared/MobileRecordList";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { DataViewSearch } from "@/components/shared/DataViewSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { FieldError } from "@/components/shared/FieldError";
import { PageContainer } from "@/components/shared/PageContainer";

/** Course-list page size — real pagination reaches every course (#785). */
const COURSES_PAGE_SIZE = 20;

/** A course record with name, code, and description. */
/** A single course record returned from the API. */
interface CourseRow {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** Generic paginated API response wrapper. */
/** Paginated API response with metadata. */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Admin course management page with search, create, edit, and delete operations. */
/**
 * Admin page for managing courses.
 * Supports listing, searching, creating, editing, and deleting courses
 * with inline form validation and toast feedback.
 */
export function CoursePage() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Search is split into two states (same contract as QuestionPage):
  // searchInput is the live text in the field; committedSearch is the term
  // actually sent to the server (debounced DataViewSearch commit). Typing
  // never fires a request per keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  // Latest-request guard: rapid search/page flips fire overlapping course
  // requests; a stale response resolving last must not overwrite the table.
  const coursesGenRef = useRef(0);
  // B12: the query identity whose response is currently rendered. Until it
  // equals the submitted query, the list body shows the pending state — old
  // rows are never presented as the new query's result.
  const loadedKeyRef = useRef<string | null>(null);
  const queryKey = `${page}|${committedSearch}`;

  const loadCourses = useCallback(async () => {
    const generation = ++coursesGenRef.current;
    const isStale = () => generation !== coursesGenRef.current;
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(COURSES_PAGE_SIZE),
      });
      if (committedSearch.trim()) params.set("search", committedSearch.trim());
      const data = await api.get<PaginatedResponse<CourseRow>>(
        `/api/courses?${params.toString()}`,
      );
      if (isStale()) return;
      // B11: an empty page while records exist elsewhere is an out-of-range
      // page (e.g. after a deletion). Never commit it — it would render a
      // fake empty state. Jump straight to the last valid page in one step
      // and stay pending until its rows land.
      if (data.items.length === 0 && data.total > 0 && page > 1) {
        const lastValidPage = Math.max(
          1,
          Math.ceil(data.total / COURSES_PAGE_SIZE),
        );
        if (lastValidPage < page) {
          setPage(lastValidPage);
          return;
        }
      }
      setCourses(data.items);
      setTotal(data.total);
      loadedKeyRef.current = queryKey;
    } catch {
      if (isStale()) return;
      setError(t("admin.courses.loadFailed"));
    }
  }, [page, committedSearch, queryKey, t]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  /** A search commit is a new query: it resets to the first page (#785). */
  function handleSearchCommit(term: string) {
    setCommittedSearch(term);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setCommittedSearch("");
    setPage(1);
  }

  /** Resets the form and opens the dialog for creating a new course. */
  function openCreate() {
    setEditingCourse(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFieldErrors({});
    setDialogOpen(true);
  }

  /** Populates the form with the given course's data and opens the edit dialog. */
  function openEdit(course: CourseRow) {
    setEditingCourse(course);
    setFormName(course.name);
    setFormCode(course.code);
    setFormDescription(course.description);
    setFieldErrors({});
    setDialogOpen(true);
  }

  /** Validates the course form fields and returns true if valid. */
  function validate() {
    const errors: Record<string, string> = {};
    if (!formName.trim())
      errors.name = t("admin.courses.validation.nameRequired");
    if (!formCode.trim())
      errors.code = t("admin.courses.validation.codeRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /** Validates and persists the course via create or update API, then reloads the list. */
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingCourse) {
        await api.patch(`/api/courses/${editingCourse.id}`, {
          name: formName,
          code: formCode,
          description: formDescription,
        });
      } else {
        await api.post("/api/courses", {
          name: formName,
          code: formCode,
          description: formDescription,
        });
      }
      setDialogOpen(false);
      toast.success(
        editingCourse
          ? t("admin.courses.toast.updated")
          : t("admin.courses.toast.created"),
      );
      await loadCourses();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, t("admin.common.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  /** Deletes the course with the given id and reloads the list. */
  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/courses/${id}`);
      toast.success(t("admin.courses.toast.deleted"));
      // If this page became empty, loadCourses jumps to the last valid page
      // (B11) instead of committing the empty response.
      await loadCourses();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, t("admin.common.deleteFailed")));
    }
  }

  const hasSearch = committedSearch.trim() !== "";

  const toolbar =
    // Product rule (pinned by test): the search box only exists when
    // there is something to search — an empty collection with no
    // active search. A no-match result keeps the box so the term
    // stays visible and clearable (#785: search is server-side).
    total > 0 || hasSearch ? (
      <DataToolbar
        search={
          <DataViewSearch
            aria-label={t("admin.courses.searchLabel")}
            placeholder={t("admin.courses.searchPlaceholder")}
            value={searchInput}
            onChange={setSearchInput}
            onSearch={handleSearchCommit}
            clearLabel={t("admin.courses.clearSearchLabel")}
          />
        }
      />
    ) : undefined;

  if (error) return <ErrorState message={error} onRetry={loadCourses} />;

  // Never-loaded: bare initial loader. In-flight query change (B11/B12):
  // the single shell keeps its toolbar/footer mounted, list body shows the
  // pending state — stale rows and fake empty states are never rendered.
  if (loadedKeyRef.current === null) return <LoadingState />;
  const pending = loadedKeyRef.current !== queryKey;

  /** The one shell composition for this page: the footer authority is
   * declared once; pending and loaded states only vary body and mobile. */
  function renderShell(body: ReactNode, mobile?: ReactNode) {
    return (
      <DataTableShell
        toolbar={toolbar}
        footer={
          <DataViewFooter
            range={{ page, pageSize: COURSES_PAGE_SIZE, total }}
            navigation={
              <DataTablePagination
                page={page}
                pageSize={COURSES_PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            }
          />
        }
        mobile={mobile}
      >
        {body}
      </DataTableShell>
    );
  }

  // Single-source column declarations (issue 457): desktop table and mobile
  // cards render from the same array.
  const columns: DataViewColumnDef<CourseRow>[] = [
    {
      id: "name",
      meta: { role: "primary-text" },
      header: t("admin.courses.columns.name"),
      cell: ({ row }) => row.original.name,
    },
    {
      id: "code",
      meta: { role: "short-id" },
      header: t("admin.courses.columns.code"),
      cell: ({ row }) => (
        <DataTableOverflowText
          mode="truncate-middle"
          value={row.original.code}
        />
      ),
    },
    {
      id: "description",
      meta: { role: "description", overflow: "line-clamp-2" },
      header: t("admin.courses.columns.description"),
      cell: ({ row }) =>
        row.original.description ? (
          <DataTableOverflowText
            mode="line-clamp-2"
            value={row.original.description}
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "actions",
      meta: { role: "actions" },
      header: t("admin.courses.columns.actions"),
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          actions={[
            {
              id: "edit",
              label: t("admin.courses.editLabel"),
              icon: Pencil,
              onSelect: () => openEdit(row.original),
            },
            {
              id: "delete",
              label: t("admin.courses.deleteLabel"),
              icon: Trash2,
              tone: "destructive",
              confirm: {
                title: t("admin.common.confirm"),
                description: t("admin.courses.enableDisable", {
                  action: t("admin.common.delete"),
                  name: row.original.name,
                }),
                destructive: true,
              },
              onSelect: () => void handleDelete(row.original.id),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <TooltipProvider>
      <PageContainer role="admin-standard" className="flex flex-col gap-6">
        <PageHeader
          title={t("admin.courses.title")}
          actions={
            <Button onClick={openCreate}>
              <AppIcon icon={Plus} size="inline" />
              {t("admin.courses.createBtn")}
            </Button>
          }
        />

        {renderShell(
          pending ? (
            <LoadingState />
          ) : total === 0 && !hasSearch ? (
            <EmptyState
              icon={<AppIcon icon={BookOpen} size="state" />}
              title={t("admin.courses.empty")}
              description={t("admin.courses.emptyDescription")}
            />
          ) : total === 0 && hasSearch ? (
            <EmptyState
              icon={<AppIcon icon={Search} size="state" />}
              title={t("admin.courses.noMatch")}
              description={t("admin.courses.noMatchDescription", {
                q: committedSearch,
              })}
              action={
                <Button variant="outline" onClick={clearSearch}>
                  {t("admin.common.clearSearch")}
                </Button>
              }
            />
          ) : (
            <DesktopDataTable
              columns={columns}
              data={courses}
              getRowId={(c) => c.id}
            />
          ),
          pending ? undefined : (
            <MobileRecordList
              columns={columns}
              rows={courses}
              getRowId={(c) => c.id}
              empty={courses.length === 0}
              emptyTitle={t(
                total === 0 ? "admin.courses.empty" : "admin.courses.noMatch",
              )}
              emptyDescription={t(
                total === 0
                  ? "admin.courses.emptyDescription"
                  : "admin.courses.noMatchDescription",
                { q: committedSearch },
              )}
            />
          ),
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editingCourse
                  ? t("admin.courses.dialog.edit")
                  : t("admin.courses.dialog.create")}
              </DialogTitle>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <Label htmlFor="course-name">
                  {t("admin.courses.dialog.name")}
                  <span aria-hidden="true" className="ml-1 text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="course-name"
                  required
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (fieldErrors.name)
                      setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder={t("admin.courses.dialog.namePlaceholder")}
                />
                <FieldError>{fieldErrors.name}</FieldError>
              </Field>
              <Field>
                <Label htmlFor="course-code">
                  {t("admin.courses.dialog.code")}
                  <span aria-hidden="true" className="ml-1 text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="course-code"
                  required
                  value={formCode}
                  onChange={(e) => {
                    setFormCode(e.target.value);
                    if (fieldErrors.code)
                      setFieldErrors((prev) => ({ ...prev, code: "" }));
                  }}
                  placeholder={t("admin.courses.dialog.codePlaceholder")}
                />
                <FieldError>{fieldErrors.code}</FieldError>
              </Field>
              <Field>
                <Label htmlFor="course-desc">
                  {t("admin.courses.columns.description")}
                </Label>
                <Textarea
                  id="course-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("admin.courses.columns.description")}
                  rows={4}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("admin.common.cancel")}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? t("admin.common.saving") : t("admin.common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </TooltipProvider>
  );
}
