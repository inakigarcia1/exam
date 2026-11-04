/**
 * CSV file formats shared by the web importers and the API (import + export).
 * One authority per format: the header, the row → request mapping and the
 * entity → row mapping live here so import and export cannot drift.
 *
 * Lists inside one cell (options, scale columns, multi answers, tags) are
 * separated by `|`.
 */

const LIST_SEPARATOR = "|";
const OPTION_IDS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Prefixes the API export guards with a leading `'` (formula injection). */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r", "\n"]);

/** RFC 4180 parser: quoted cells may contain commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Serializes one CSV line, quoting cells that need it. */
export function formatCsvLine(cells: readonly string[]): string {
  return cells
    .map((cell) =>
      /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
    )
    .join(",");
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unguard(value: string): string {
  return value.startsWith("'") && FORMULA_PREFIXES.has(value[1] ?? "")
    ? value.slice(1)
    : value;
}

/** Result of reading a CSV file against a fixed header. */
export interface CsvRecords<K extends string> {
  records: Record<K, string>[];
  /** Header columns the file does not have; non-empty means unusable. */
  missingColumns: K[];
}

/**
 * Reads data rows keyed by the canonical header. Header matching ignores
 * case and accents (`contrasena` reads as `contraseña`); extra columns are
 * ignored.
 */
export function parseCsvRecords<K extends string>(
  text: string,
  header: readonly K[],
): CsvRecords<K> {
  const [first, ...data] = parseCsv(text);
  const positions = new Map(
    (first ?? []).map((name, index) => [normalizeHeader(name), index]),
  );
  const missingColumns = header.filter(
    (name) => !positions.has(normalizeHeader(name)),
  );
  const records = data.map(
    (cells) =>
      Object.fromEntries(
        header.map((name) => {
          const index = positions.get(normalizeHeader(name));
          return [
            name,
            unguard((index === undefined ? "" : cells[index]) ?? "").trim(),
          ];
        }),
      ) as Record<K, string>,
  );
  return { records, missingColumns };
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

// ── Questions ───────────────────────────────────────────────────────────

export const QUESTION_CSV_HEADER = [
  "tipo",
  "enunciado",
  "opciones",
  "respuesta",
  "columnas",
  "criterio",
  "dificultad",
  "etiquetas",
] as const;

export type QuestionCsvColumn = (typeof QUESTION_CSV_HEADER)[number];
export type QuestionCsvRecord = Record<QuestionCsvColumn, string>;

const TRUE_TOKENS = new Set(["verdadero", "v", "si", "sí", "true"]);
const FALSE_TOKENS = new Set(["falso", "f", "no", "false"]);

function parseBoolean(value: string): boolean | string {
  const token = value.trim().toLowerCase();
  if (TRUE_TOKENS.has(token)) return true;
  if (FALSE_TOKENS.has(token)) return false;
  return value;
}

/**
 * Maps one CSV record to a create-question request body. The result is
 * unvalidated: the caller parses it with `CreateQuestionRequestSchema`,
 * which rejects anything this mapping could not make sense of.
 *
 * - `respuesta`: choice → option letters (`B`, `A|C`); true_false →
 *   verdadero/falso; fill_blank → the text (`|` separates accepted
 *   alternatives); text_response → optional reference answer; likert → the
 *   1-based column of each row (`1|3|2`); ranking → ignored, the `opciones`
 *   order is the correct order.
 * - `columnas`: likert scale labels. `criterio`: text_response rubric.
 */
export function questionFromCsvRecord(
  record: Partial<Record<QuestionCsvColumn, string>>,
): Record<string, unknown> {
  const type = (record.tipo ?? "").trim();
  const options = splitList(record.opciones).map((content, index) => ({
    id: OPTION_IDS[index] ?? String(index + 1),
    content,
  }));
  const ids = options.map((o) => o.id);
  const answer = (record.respuesta ?? "").trim();
  const letterToId = (letter: string) => {
    const index = OPTION_IDS.indexOf(letter.trim().toUpperCase());
    return index >= 0 && index < ids.length ? ids[index]! : letter;
  };

  let standardAnswer: unknown;
  switch (type) {
    case "single_choice":
      standardAnswer = letterToId(answer);
      break;
    case "multiple_choice":
      standardAnswer = splitList(answer).map(letterToId);
      break;
    case "true_false":
      standardAnswer = parseBoolean(answer);
      break;
    case "likert": {
      const columns = splitList(answer);
      standardAnswer = Object.fromEntries(
        ids.flatMap((id, index) =>
          columns[index] === undefined
            ? []
            : [[id, Number(columns[index]) - 1]],
        ),
      );
      break;
    }
    case "ranking":
      standardAnswer = ids;
      break;
    case "text_response":
      standardAnswer = answer === "" ? null : answer;
      break;
    default:
      standardAnswer = answer;
  }

  const difficulty = (record.dificultad ?? "").trim();
  const rubric = (record.criterio ?? "").trim();
  return {
    type,
    content: (record.enunciado ?? "").trim(),
    options,
    standardAnswer,
    scale: type === "likert" ? splitList(record.columnas) : null,
    rubric: rubric === "" ? null : rubric,
    ...(difficulty === "" ? {} : { difficulty: Number(difficulty) }),
    tags: splitList(record.etiquetas),
  };
}

/** The question fields an export row needs. */
export interface QuestionCsvSource {
  type: string;
  content: string;
  options: { id: string; content: string }[];
  standardAnswer: unknown;
  scale: string[] | null;
  rubric: string | null;
  difficulty: number;
  tags: string[];
}

/** Inverse of {@link questionFromCsvRecord}; rich content exports as its plain projection. */
export function questionToCsvRecord(q: QuestionCsvSource): QuestionCsvRecord {
  const letterOf = (id: unknown) => {
    const index = q.options.findIndex((o) => o.id === id);
    return index >= 0 ? (OPTION_IDS[index] ?? String(id)) : String(id ?? "");
  };
  const answer = q.standardAnswer;
  let respuesta = "";
  switch (q.type) {
    case "single_choice":
      respuesta = letterOf(answer);
      break;
    case "multiple_choice":
      respuesta = Array.isArray(answer)
        ? answer.map(letterOf).join(LIST_SEPARATOR)
        : "";
      break;
    case "true_false":
      respuesta = answer === true ? "verdadero" : "falso";
      break;
    case "likert": {
      const picks =
        typeof answer === "object" && answer !== null
          ? (answer as Record<string, unknown>)
          : {};
      respuesta = q.options
        .map((o) =>
          typeof picks[o.id] === "number"
            ? String((picks[o.id] as number) + 1)
            : "",
        )
        .join(LIST_SEPARATOR);
      break;
    }
    case "ranking":
      respuesta = "";
      break;
    default:
      respuesta = typeof answer === "string" ? answer : "";
  }
  const orderedOptions =
    q.type === "ranking" && Array.isArray(answer)
      ? answer
          .map((id) => q.options.find((o) => o.id === id))
          .filter((o): o is { id: string; content: string } => o !== undefined)
      : q.options;
  return {
    tipo: q.type,
    enunciado: q.content,
    opciones:
      q.type === "true_false"
        ? ""
        : orderedOptions.map((o) => o.content).join(LIST_SEPARATOR),
    respuesta,
    columnas: (q.scale ?? []).join(LIST_SEPARATOR),
    criterio: q.rubric ?? "",
    dificultad: String(q.difficulty),
    etiquetas: q.tags.join(LIST_SEPARATOR),
  };
}

// ── Candidates ──────────────────────────────────────────────────────────

export const CANDIDATE_CSV_HEADER = ["legajo", "nombre", "contraseña"] as const;

export type CandidateCsvColumn = (typeof CANDIDATE_CSV_HEADER)[number];

/**
 * An empty `contraseña` keeps the current password of an existing candidate;
 * a new candidate needs one.
 */
export function candidateFromCsvRecord(
  record: Record<CandidateCsvColumn, string>,
): { username: string; name: string; password?: string } {
  return {
    username: record.legajo,
    name: record.nombre,
    ...(record["contraseña"] ? { password: record["contraseña"] } : {}),
  };
}

/** Passwords are stored hashed, so the export leaves the column empty. */
export function candidateToCsvRecord(c: {
  username: string;
  name: string;
}): Record<CandidateCsvColumn, string> {
  return { legajo: c.username, nombre: c.name, contraseña: "" };
}
