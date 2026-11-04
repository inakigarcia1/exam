import {
  QUESTION_CSV_HEADER,
  formatCsvLine,
  parseCsvRecords,
  type QuestionCsvRecord,
} from "@exam/contracts";

/**
 * One example row per question type. Template content is CSV data, not UI
 * copy: it documents the import format the contracts codec understands.
 */
// i18n-copy-allow: data-format — CSV template example rows
const TEMPLATE_ROWS: QuestionCsvRecord[] = [
  row(
    "single_choice",
    "¿Cuánto es 2 + 2?",
    "3|4|5",
    "B",
    "",
    "",
    "1",
    "aritmetica",
  ),
  row(
    "multiple_choice",
    "¿Cuáles son números primos?",
    "2|3|4|9",
    "A|B",
    "",
    "",
    "2",
    "aritmetica",
  ),
  row(
    "true_false",
    "La Tierra gira alrededor del Sol",
    "",
    "verdadero",
    "",
    "",
    "1",
    "ciencias",
  ),
  row(
    "fill_blank",
    "La capital de Francia es ____",
    "",
    "París",
    "",
    "",
    "1",
    "geografia",
  ),
  row(
    "text_response",
    "Explicá el ciclo del agua",
    "",
    "",
    "",
    "Menciona evaporación, condensación y precipitación",
    "3",
    "ciencias",
  ),
  row(
    "likert",
    "Indicá tu nivel de acuerdo",
    "Las clases fueron claras|El material fue útil",
    "1|2",
    "De acuerdo|Neutral|En desacuerdo",
    "",
    "1",
    "encuesta",
  ),
  row(
    "ranking",
    "Ordená de menor a mayor",
    "1|5|10|50",
    "",
    "",
    "",
    "2",
    "aritmetica",
  ),
];

function row(...cells: string[]): QuestionCsvRecord {
  return Object.fromEntries(
    QUESTION_CSV_HEADER.map((name, i) => [name, cells[i] ?? ""]),
  ) as QuestionCsvRecord;
}

/** The question CSV template: header plus one example per type. */
export function questionCsvTemplate(): string {
  return [
    formatCsvLine(QUESTION_CSV_HEADER),
    ...TEMPLATE_ROWS.map((r) =>
      formatCsvLine(QUESTION_CSV_HEADER.map((name) => r[name])),
    ),
  ].join("\n");
}

export function downloadQuestionTemplate(filename = "plantilla-preguntas.csv") {
  const blob = new Blob(["\uFEFF" + questionCsvTemplate()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Reads a question CSV; rows go to POST /api/questions/import as-is. */
export function readQuestionCsv(text: string) {
  return parseCsvRecords(text, QUESTION_CSV_HEADER);
}
