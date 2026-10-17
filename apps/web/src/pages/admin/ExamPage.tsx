import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useProductDateTime } from "@/contexts/DateTimeContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { AppIcon } from "@/components/shared/AppIcon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { DataViewFooter } from "@/components/shared/DataViewFooter";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { DataToolbar, ToolbarFilter } from "@/components/shared/DataToolbar";
import { MobileRecordList } from "@/components/shared/MobileRecordList";
import {
  DesktopDataTable,
  type DataViewColumnDef,
} from "@/components/shared/DesktopDataTable";
import {
  RowActions,
  type RowActionDeclaration,
} from "@/components/shared/RowActions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/shared/PageContainer";
import { ClipboardList, Eye, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canCreateExam, canDeleteExam } from "@/lib/capabilities";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { deleteDisabledReasonKey } from "@/lib/examDisabledReasons";
import { getStatusMeta } from "@/lib/statusMeta";
import { statusLabelKey } from "@/lib/statusMetaUtils";
import { ExamStatusEnum, type ExamStatus } from "@exam/contracts";
import type { DeleteDisabledReasonCode } from "@exam/contracts";

/** Exam-list page size — real pagination reaches every exam (#785). */
const EXAMS_PAGE_SIZE = 20;

/** Row shape returned by the exams list API. */
interface ExamRow {
  id: string;
  title: string;
  status: string;
  openAt: string;
  closeAt: string;
  durationMinutes: number;
  passingScore: number;
  totalScore: number;
  questionIds: string[];
  participantCount: number;
  canDelete: boolean;
  deleteDisabledReasonCode: DeleteDisabledReasonCode | null;
  /** Legacy natural-language sibling — compatibility fallback only (D0.8). */
  deleteDisabledReason: string | null;
}

/** Generic paginated API response wrapper. */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Select value for "no status filter" (the parameter-less default). */
const STATUS_ALL = "all";

/**
 * Admin page for listing, viewing, and deleting exams. Server-side
 * pagination plus an optional status filter (#785): every authorized exam is
 * reachable by paging, the total comes from the response, and a stale
 * response can never overwrite a newer query's data.
 */
export function ExamPage() {
  const { t } = useTranslation();
  const { formatDateRange } = useProductDateTime();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ExamStatus>(
    STATUS_ALL,
  );
  // Latest-request guard: rapid filter/page flips fire overlapping exams
  // requests; a stale response resolving last must not overwrite the table
  // (same contract as UsersPage/QuestionPage).
  const examsGenRef = useRef(0);
  const mayCreateExam = user ? canCreateExam(user) : false;
  const mayDeleteExam = user ? canDeleteExam(user) : false;

  /**
   * Tooltip explanation why deletion is blocked. The machine
   * DisabledReasonCode is authoritative (D0.8); the legacy natural-language
   * wire field only covers unknown future codes.
   */
  function deleteDisabledReasonPresentation(exam: ExamRow): string {
    const code = exam.deleteDisabledReasonCode;
    if (code) {
      const key = deleteDisabledReasonKey(code);
      if (key) return t(key);
    }
    return exam.deleteDisabledReason ?? t("admin.exams.deleteDisabled");
  }

  const loadExams = useCallback(async () => {
    const generation = ++examsGenRef.current;
    const isStale = () => generation !== examsGenRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(EXAMS_PAGE_SIZE),
      });
      if (statusFilter !== STATUS_ALL) params.set("statuses", statusFilter);
      const data = await api.get<PaginatedResponse<ExamRow>>(
        `/api/exams?${params.toString()}`,
      );
      if (isStale()) return;
      setExams(data.items);
      setTotal(data.total);
    } catch {
      if (isStale()) return;
      setError(t("admin.exams.loadFailed"));
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  // Out-of-range page recovery (#785 B07): a deletion (or concurrent change)
  // can leave the current page beyond the last valid one. A response with
  // rows elsewhere (total > 0) but an empty page means the page number is
  // stale — step back and requery instead of rendering a fake empty state.
  // Bounded: at page 1 an empty page with total > 0 stops the loop.
  useEffect(() => {
    if (!isLoading && total > 0 && exams.length === 0 && page > 1) {
      setPage(page - 1);
    }
  }, [isLoading, total, exams.length, page]);

  /** A filter change is a new query: it resets to the first page (B06). */
  function handleStatusFilterChange(value: string) {
    setStatusFilter(value === STATUS_ALL ? STATUS_ALL : (value as ExamStatus));
    setPage(1);
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/exams/${id}`);
      toast.success(t("admin.exams.toast.deleted"));
      // The out-of-range effect steps back when this page became empty.
      await loadExams();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, t, t("admin.exams.toast.deleteFailed")),
      );
    }
  }

  // Full-page loader only for the initial load: page flips keep the table
  // (and its pagination controls) mounted while the next page is in flight.
  if (isLoading && exams.length === 0 && total === 0) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadExams} />;

  // Single-source column declarations (issue 457): desktop table and mobile
  // cards render from the same array. The time window joins the meta line —
  // without the override it would be dropped (date-range defaults to low),
  // losing the exam's availability window on mobile.
  const columns: DataViewColumnDef<ExamRow>[] = [
    {
      id: "title",
      meta: { role: "primary-text" },
      header: t("admin.exams.columns.title"),
      cell: ({ row }) => row.original.title,
    },
    {
      id: "status",
      meta: { role: "status" },
      header: t("admin.exams.columns.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "timeWindow",
      meta: { role: "date-range", priority: "normal" },
      header: t("admin.exams.columns.timeWindow"),
      cell: ({ row }) => (
        <span className="type-secondary">
          {formatDateRange(row.original.openAt, row.original.closeAt)}
        </span>
      ),
    },
    {
      id: "duration",
      meta: { role: "duration" },
      header: t("admin.exams.columns.duration"),
      cell: ({ row }) =>
        t("admin.exams.duration", { min: row.original.durationMinutes }),
    },
    {
      id: "questionCount",
      meta: { role: "number" },
      header: t("admin.exams.columns.questionCount"),
      cell: ({ row }) => row.original.questionIds.length,
    },
    {
      id: "participantCount",
      meta: { role: "number" },
      header: t("admin.exams.columns.participants"),
      cell: ({ row }) => row.original.participantCount,
    },
    {
      id: "passingScore",
      meta: { role: "score" },
      header: t("admin.exams.columns.passingScore"),
      cell: ({ row }) =>
        `${row.original.passingScore}/${row.original.totalScore}`,
    },
    {
      id: "actions",
      meta: { role: "actions" },
      header: t("admin.exams.columns.actions"),
      cell: ({ row }) => {
        const exam = row.original;
        return (
          <RowActions
            row={exam}
            actions={[
              {
                id: "view",
                label: t("admin.exams.viewDetail"),
                icon: Eye,
                onSelect: () => void navigate(`/admin/exams/${exam.id}`),
              },
              ...(mayDeleteExam
                ? ([
                    {
                      id: "delete",
                      label: t("admin.exams.deleteLabel"),
                      icon: Trash2,
                      tone: "destructive",
                      disabled: exam.canDelete
                        ? false
                        : {
                            reason: deleteDisabledReasonPresentation(exam),
                          },
                      confirm: {
                        title: t("admin.exams.confirmDelete"),
                        description: t("admin.exams.confirmDeleteDescription", {
                          title: exam.title,
                        }),
                        destructive: true,
                      },
                      onSelect: () => void handleDelete(exam.id),
                    },
                  ] as RowActionDeclaration<typeof exam>[])
                : []),
            ]}
          />
        );
      },
    },
  ];

  const hasStatusFilter = statusFilter !== STATUS_ALL;

  return (
    <TooltipProvider>
      <PageContainer role="admin-dense" className="flex flex-col gap-6">
        <PageHeader
          title={t("admin.exams.title")}
          actions={
            mayCreateExam ? (
              <Button onClick={() => void navigate("/admin/exams/new")}>
                <AppIcon icon={Plus} size="inline" />
                {t("admin.exams.createBtn")}
              </Button>
            ) : undefined
          }
        />

        {exams.length === 0 && !hasStatusFilter ? (
          <EmptyState
            icon={<AppIcon icon={ClipboardList} size="state" />}
            title={t("admin.exams.empty")}
            description={t("admin.exams.emptyDescription")}
          />
        ) : exams.length === 0 && hasStatusFilter ? (
          <EmptyState
            icon={<AppIcon icon={ClipboardList} size="state" />}
            title={t("admin.exams.noMatch")}
            description={t("admin.exams.noMatchDescription")}
            action={
              <Button
                variant="outline"
                onClick={() => handleStatusFilterChange(STATUS_ALL)}
              >
                {t("admin.exams.clearFilterLabel")}
              </Button>
            }
          />
        ) : (
          <DataTableShell
            title={t("admin.exams.listTitle")}
            description={t("admin.exams.listDescription")}
            toolbar={
              <DataToolbar aria-label={t("admin.exams.toolbarLabel")}>
                <ToolbarFilter size="narrow">
                  <Select
                    value={statusFilter}
                    onValueChange={handleStatusFilterChange}
                  >
                    <SelectTrigger
                      aria-label={t("admin.exams.statusFilterLabel")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>
                        {t("admin.exams.statusAll")}
                      </SelectItem>
                      {ExamStatusEnum.options.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(statusLabelKey(getStatusMeta(status).labelKey))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ToolbarFilter>
              </DataToolbar>
            }
            footer={
              <DataViewFooter
                range={{ page, pageSize: EXAMS_PAGE_SIZE, total }}
                navigation={
                  <DataTablePagination
                    page={page}
                    pageSize={EXAMS_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                  />
                }
              />
            }
            mobile={
              <MobileRecordList
                columns={columns}
                rows={exams}
                getRowId={(e) => e.id}
              />
            }
          >
            <DesktopDataTable
              columns={columns}
              data={exams}
              getRowId={(e) => e.id}
            />
          </DataTableShell>
        )}
      </PageContainer>
    </TooltipProvider>
  );
}
