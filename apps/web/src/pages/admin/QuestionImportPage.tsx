import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { resolveListReturnPath } from "@/lib/listReturnNavigation";
import { routes } from "@/lib/routes";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { AppIcon } from "@/components/shared/AppIcon";
import { ErrorState } from "@/components/shared/ErrorState";
import { FileUpload } from "@/components/shared/FileUpload";
import {
  DataTableCell,
  DataTableSurface,
  DataTableHead,
  DataTableOverflowText,
} from "@/components/shared/DataTableContract";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { ToolbarFilter } from "@/components/shared/DataToolbar";
import { FormSection } from "@/components/shared/FormSection";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/shared/PageContainer";
import { CircleCheck, CircleAlert, CircleX } from "lucide-react";
import { getTypeLabelKey } from "@/lib/constants";
import { downloadQuestionTemplate, readQuestionCsv } from "@/lib/questionCsv";
import type { QuestionCsvRecord } from "@exam/contracts";

/** Minimal course representation used to populate the course selector. */
interface CourseRow {
  id: string;
  name: string;
  code: string;
}

/** Summary and per-row details returned by the import validation endpoint. */
interface ImportResult {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  details: Array<{
    row: number;
    status: "valid" | "warning" | "error";
    message?: string;
  }>;
}

/** Admin page for bulk-importing questions from a CSV file into a selected course. */
export function QuestionImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<QuestionCsvRecord[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  /** Fetches the course list and selects the first course by default. */
  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ items: CourseRow[] }>("/api/courses");
      setCourses(data.items);
      if (data.items.length > 0) {
        const first = data.items[0];
        if (first) setSelectedCourse(first.id);
      }
    } catch {
      setError(t("admin.questionImport.errors.loadCoursesFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  /** Parses raw CSV text into import rows and resets prior results. */
  function loadCsv(text: string) {
    const { records, missingColumns } = readQuestionCsv(text);
    setMissingColumns(missingColumns);
    setParsedRows(missingColumns.length > 0 ? [] : records);
    setImportResult(null);
    setConfirmed(false);
  }

  /**
   * Submits the parsed rows to the import endpoint for validation or
   * confirmed insertion, and stores the result.
   */
  async function handleImport(confirm: boolean) {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api.post<ImportResult>("/api/questions/import", {
        rows: parsedRows,
        confirm,
      });
      setImportResult(result);
      setConfirmed(confirm);
    } catch {
      setError(t("admin.questionImport.errors.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadCourses} />;

  return (
    <PageContainer role="form" className="flex flex-col gap-6">
      <PageHeader title={t("admin.questionImport.title")} />

      {/* The import inputs are a FORM, not a dataset-scoped toolbar: they
          configure the import (target course, template, file) rather than
          filtering a dataset, so they render as a form section above the
          preview tables instead of opening a data-view toolbar band. */}
      <FormSection
        title={t("admin.questionImport.courseLabel")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadQuestionTemplate(
                  t("admin.questionImport.templateFilename"),
                )
              }
            >
              {t("admin.questionImport.downloadTemplate")}
            </Button>
            <FileUpload onText={loadCsv} />
          </>
        }
      >
        {missingColumns.length > 0 && (
          <p className="text-sm text-destructive">
            {t("admin.questionImport.errors.missingColumns", {
              columns: missingColumns.join(", "),
            })}
          </p>
        )}
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <ToolbarFilter size="wide">
            <SelectTrigger>
              <SelectValue
                placeholder={t("admin.questionImport.coursePlaceholder")}
              />
            </SelectTrigger>
          </ToolbarFilter>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormSection>

      {parsedRows.length > 0 && !importResult && (
        <>
          <DataTableShell
            archetype="embedded-picker"
            title={t("admin.questionImport.parsed", {
              count: parsedRows.length,
            })}
          >
            <DataTableSurface
              columns={[
                { role: "number" },
                { role: "type" },
                { role: "long-text", overflow: "truncate" },
                { role: "number" },
              ]}
            >
              <TableHeader>
                <TableRow>
                  <DataTableHead role="number">
                    {t("admin.questionImport.previewColumns.row")}
                  </DataTableHead>
                  <DataTableHead role="type">
                    {t("admin.questionImport.previewColumns.type")}
                  </DataTableHead>
                  <DataTableHead role="long-text">
                    {t("admin.questionImport.previewColumns.content")}
                  </DataTableHead>
                  <DataTableHead role="number">
                    {t("admin.forms.question.difficulty")}
                  </DataTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.slice(0, 20).map((row, i) => (
                  <TableRow key={i}>
                    <DataTableCell role="number">{i + 1}</DataTableCell>
                    <DataTableCell role="type">
                      <Badge variant="outline">
                        {(getTypeLabelKey(row.tipo)
                          ? t(getTypeLabelKey(row.tipo) as never)
                          : undefined) ?? row.tipo}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell role="long-text">
                      <DataTableOverflowText
                        mode="truncate"
                        value={row.enunciado}
                      />
                    </DataTableCell>
                    <DataTableCell role="number">
                      {row.dificultad || "—"}
                    </DataTableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTableSurface>
          </DataTableShell>
          {parsedRows.length > 20 && (
            <p className="type-secondary">
              {t("admin.questionImport.moreRows", {
                count: parsedRows.length - 20,
              })}
            </p>
          )}
          <Button onClick={() => void handleImport(false)} disabled={importing}>
            {importing
              ? t("admin.questionImport.validating")
              : t("admin.questionImport.validate")}
          </Button>
        </>
      )}

      {importResult && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <AppIcon
                icon={CircleCheck}
                size="inline"
                className="text-success"
              />
              {t("admin.questionImport.result.valid")}: {importResult.valid}
            </span>
            <span className="flex items-center gap-1">
              <AppIcon
                icon={CircleAlert}
                size="inline"
                className="text-warning"
              />
              {t("admin.questionImport.result.warnings")}:{" "}
              {importResult.warnings}
            </span>
            <span className="flex items-center gap-1">
              <AppIcon
                icon={CircleX}
                size="inline"
                className="text-destructive"
              />
              {t("admin.questionImport.result.errors")}: {importResult.errors}
            </span>
          </div>

          <DataTableShell
            archetype="embedded-picker"
            title={t("admin.questionImport.previewColumns.detail")}
          >
            <DataTableSurface
              columns={[
                { role: "number" },
                { role: "status" },
                { role: "long-text", overflow: "truncate" },
              ]}
            >
              <TableHeader>
                <TableRow>
                  <DataTableHead role="number">
                    {t("admin.questionImport.previewColumns.row")}
                  </DataTableHead>
                  <DataTableHead role="status">
                    {t("admin.questionImport.previewColumns.status")}
                  </DataTableHead>
                  <DataTableHead role="long-text">
                    {t("admin.questionImport.previewColumns.detail")}
                  </DataTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResult.details.map((d) => (
                  <TableRow key={d.row}>
                    <DataTableCell role="number">{d.row}</DataTableCell>
                    <DataTableCell role="status">
                      {d.status === "valid" && (
                        <AppIcon
                          icon={CircleCheck}
                          size="inline"
                          className="text-success"
                        />
                      )}
                      {d.status === "warning" && (
                        <AppIcon
                          icon={CircleAlert}
                          size="inline"
                          className="text-warning"
                        />
                      )}
                      {d.status === "error" && (
                        <AppIcon
                          icon={CircleX}
                          size="inline"
                          className="text-destructive"
                        />
                      )}
                    </DataTableCell>
                    <DataTableCell role="long-text" className="type-secondary">
                      {d.message ? (
                        <DataTableOverflowText
                          mode="truncate"
                          value={d.message}
                        />
                      ) : (
                        "-"
                      )}
                    </DataTableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTableSurface>
          </DataTableShell>

          <div className="flex gap-3">
            {!confirmed && importResult.errors === 0 && (
              <Button
                onClick={() => void handleImport(true)}
                disabled={importing}
              >
                {importing
                  ? t("admin.questionImport.importing")
                  : t("admin.questionImport.confirm")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                void navigate(
                  resolveListReturnPath(location.state, routes.admin.questions),
                )
              }
            >
              {t("admin.questionImport.backToList")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setParsedRows([]);
                setImportResult(null);
                setConfirmed(false);
              }}
            >
              {t("admin.questionImport.continueImport")}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
