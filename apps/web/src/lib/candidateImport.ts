import {
  CANDIDATE_CSV_HEADER,
  candidateFromCsvRecord,
  parseCsvRecords,
} from "@exam/contracts";

/** A parsed candidate CSV row (`legajo,nombre,contraseña`). */
export type ParsedImportRow = ReturnType<typeof candidateFromCsvRecord>;

/** An existing candidate record used for duplicate detection during import. */
export interface ExistingCandidate {
  username: string;
}

/** Maximum number of data rows allowed in a single CSV import. */
export const MAX_IMPORT_ROWS = 500;

/** Result of parsing a CSV file for candidate import. */
export interface ParseImportCsvResult {
  rows: ParsedImportRow[];
  truncated: boolean;
  totalLines: number;
  /** Required columns (`legajo`, `nombre`) the header lacks. */
  missingColumns: string[];
}

/** Parses a candidate CSV. Truncates at MAX_IMPORT_ROWS. */
export function parseImportCsv(csv: string): ParseImportCsvResult {
  const { records, missingColumns } = parseCsvRecords(
    csv,
    CANDIDATE_CSV_HEADER,
  );
  return {
    rows: records.slice(0, MAX_IMPORT_ROWS).map(candidateFromCsvRecord),
    truncated: records.length > MAX_IMPORT_ROWS,
    totalLines: records.length,
    missingColumns: missingColumns.filter((c) => c !== "contraseña"),
  };
}

/** Whether the row's legajo matches a candidate already loaded. */
export function detectDuplicate(
  row: ParsedImportRow,
  existingCandidates: ExistingCandidate[],
): boolean {
  return existingCandidates.some((c) => c.username === row.username);
}
