import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useProductDateTime } from "@/contexts/DateTimeContext";
import { api } from "@/lib/api";
import { routes } from "@/lib/routes";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { AppIcon } from "@/components/shared/AppIcon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { DataViewFooter } from "@/components/shared/DataViewFooter";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
  DesktopDataTable,
  type DataViewColumnDef,
} from "@/components/shared/DesktopDataTable";
import { MobileRecordList } from "@/components/shared/MobileRecordList";
import { RowActions } from "@/components/shared/RowActions";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/shared/PageContainer";
import { Gauge, Eye } from "lucide-react";
import type { ScoreViewDisabledReasonCode } from "@exam/contracts";
import { scoreViewDisabledReasonKey } from "@/lib/examDisabledReasons";

/** Results-overview page size — real pagination reaches every exam (#785). */
const RESULTS_PAGE_SIZE = 20;

/**
 * The results-overview status set is a PRODUCT rule owned by the server
 * query (#785): lifecycle states whose results may exist. draft/canceled are
 * excluded by the `statuses` parameter — never by client-side filtering of a
 * paginated response.
 */
const RESULTS_OVERVIEW_STATUSES = "published,open,closed,archived";

/** Exam row shape as returned by the exams list API, including score-view permissions. */
interface ExamRow {
  id: string;
  title: string;
  status: string;
  openAt: string;
  closeAt: string;
  passingScore: number;
  totalScore: number;
  gradedAttemptCount: number;
  canViewScores: boolean;
  scoreViewDisabledReasonCode: ScoreViewDisabledReasonCode | null;
  /** Legacy natural-language sibling — compatibility fallback only (D0.8). */
  scoreViewDisabledReason: string | null;
}

/** Generic paginated API response wrapper. */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Admin page for browsing exams whose results may be viewable and navigating
 * to their score lists. Membership comes from the server-filtered status set
 * (`statuses=published,open,closed,archived`); the view-scores action stays a
 * server fact (`canViewScores`) independent of `status` (#785).
 */
export function ResultsOverviewPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useProductDateTime();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Latest-request guard: rapid page flips fire overlapping exams requests;
  // a stale response resolving last must not overwrite the table.
  const examsGenRef = useRef(0);
  // B12: the query identity whose response is currently rendered. Until it
  // equals the submitted query, the list body shows the pending state — old
  // rows are never presented as the new query's result.
  const loadedKeyRef = useRef<string | null>(null);
  const queryKey = `page:${page}`;

  /** Fetches the current page of the server-filtered overview set. */
  const loadExams = useCallback(async () => {
    const generation = ++examsGenRef.current;
    const isStale = () => generation !== examsGenRef.current;
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(RESULTS_PAGE_SIZE),
      });
      params.set("statuses", RESULTS_OVERVIEW_STATUSES);
      const data = await api.get<PaginatedResponse<ExamRow>>(
        `/api/exams?${params.toString()}`,
      );
      if (isStale()) return;
      // B11: an empty page while records exist elsewhere is an out-of-range
      // page (e.g. after a deletion elsewhere). Never commit it — jump
      // straight to the last valid page and stay pending until it lands.
      if (data.items.length === 0 && data.total > 0 && page > 1) {
        const lastValidPage = Math.max(
          1,
          Math.ceil(data.total / RESULTS_PAGE_SIZE),
        );
        if (lastValidPage < page) {
          setPage(lastValidPage);
          return;
        }
      }
      setExams(data.items);
      setTotal(data.total);
      loadedKeyRef.current = queryKey;
    } catch {
      if (isStale()) return;
      setError(t("admin.resultsOverview.errors.loadFailed"));
    }
  }, [page, queryKey, t]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  if (error) return <ErrorState message={error} onRetry={loadExams} />;

  // Never-loaded: bare initial loader. In-flight query change (B11/B12):
  // the single shell keeps its footer mounted, list body shows the pending
  // state — stale rows and fake empty states are never rendered.
  if (loadedKeyRef.current === null) return <LoadingState />;
  const pending = loadedKeyRef.current !== queryKey;

  /** The one shell composition for this page: the footer authority is
   * declared once; pending and loaded states only vary body and mobile. */
  function renderShell(body: ReactNode, mobile?: ReactNode) {
    return (
      <DataTableShell
        footer={
          <DataViewFooter
            range={{ page, pageSize: RESULTS_PAGE_SIZE, total }}
            navigation={
              <DataTablePagination
                page={page}
                pageSize={RESULTS_PAGE_SIZE}
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

  /** Returns whether the admin can view scores for the given exam. */
  function gradable(exam: ExamRow) {
    return exam.canViewScores;
  }

  /**
   * Returns the tooltip explanation why scores cannot be viewed. The machine
   * DisabledReasonCode is authoritative (D0.8); the legacy natural-language
   * wire field only covers unknown future codes.
   */
  function gradableReason(exam: ExamRow): string {
    const code = exam.scoreViewDisabledReasonCode;
    if (code) {
      const key = scoreViewDisabledReasonKey(code);
      if (key) return t(key);
    }
    return exam.scoreViewDisabledReason ?? "";
  }

  // Single-source column declarations (issue 457): desktop table and mobile
  // cards render from the same array.
  const columns: DataViewColumnDef<ExamRow>[] = [
    {
      id: "title",
      meta: { role: "primary-text" },
      header: t("admin.resultsOverview.columns.title"),
      cell: ({ row }) => row.original.title,
    },
    {
      id: "status",
      meta: { role: "status" },
      header: t("admin.resultsOverview.columns.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "time",
      meta: { role: "date" },
      header: t("admin.resultsOverview.columns.time"),
      cell: ({ row }) =>
        row.original.openAt ? formatDateTime(row.original.openAt) : "-",
    },
    {
      id: "gradedCount",
      meta: { role: "number" },
      header: t("admin.resultsOverview.columns.gradedCount"),
      cell: ({ row }) => row.original.gradedAttemptCount ?? 0,
    },
    {
      id: "actions",
      meta: { role: "actions" },
      header: t("admin.resultsOverview.columns.actions"),
      cell: ({ row }) => {
        const exam = row.original;
        const canView = gradable(exam);
        const reason = gradableReason(exam);
        return (
          <RowActions
            row={exam}
            actions={[
              {
                id: "view-scores",
                label: t("admin.resultsOverview.actions.viewScores"),
                icon: Eye,
                disabled: canView ? false : { reason },
                onSelect: () => void navigate(routes.admin.examScores(exam.id)),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <TooltipProvider>
      <PageContainer role="admin-standard" className="flex flex-col gap-6">
        <PageHeader title={t("admin.resultsOverview.title")} />

        {pending ? (
          renderShell(<LoadingState />)
        ) : total === 0 ? (
          <EmptyState
            icon={<AppIcon icon={Gauge} size="hero" />}
            title={t("admin.resultsOverview.empty.title")}
            description={t("admin.resultsOverview.empty.description")}
          />
        ) : (
          renderShell(
            <DesktopDataTable
              columns={columns}
              data={exams}
              getRowId={(e) => e.id}
            />,
            <MobileRecordList
              columns={columns}
              rows={exams}
              getRowId={(e) => e.id}
            />,
          )
        )}
      </PageContainer>
    </TooltipProvider>
  );
}
