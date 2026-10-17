import { useState, useEffect, useCallback, useRef } from "react";
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest-request guard: rapid page flips fire overlapping exams requests;
  // a stale response resolving last must not overwrite the table.
  const examsGenRef = useRef(0);

  /** Fetches the current page of the server-filtered overview set. */
  const loadExams = useCallback(async () => {
    const generation = ++examsGenRef.current;
    const isStale = () => generation !== examsGenRef.current;
    setIsLoading(true);
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
      setExams(data.items);
      setTotal(data.total);
    } catch {
      if (isStale()) return;
      setError(t("admin.resultsOverview.errors.loadFailed"));
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  // Out-of-range page recovery: rows exist elsewhere but this page is empty —
  // step back instead of rendering a fake empty state. Bounded at page 1.
  useEffect(() => {
    if (!isLoading && total > 0 && exams.length === 0 && page > 1) {
      setPage(page - 1);
    }
  }, [isLoading, total, exams.length, page]);

  // Full-page loader only for the initial load: page flips keep the table
  // (and its pagination controls) mounted while the next page is in flight.
  if (isLoading && exams.length === 0 && total === 0) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadExams} />;

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

        {total === 0 ? (
          <EmptyState
            icon={<AppIcon icon={Gauge} size="hero" />}
            title={t("admin.resultsOverview.empty.title")}
            description={t("admin.resultsOverview.empty.description")}
          />
        ) : (
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
