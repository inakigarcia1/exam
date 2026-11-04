import { describe, expect, it } from "vitest";
import {
  CANDIDATE_CSV_HEADER,
  QUESTION_CSV_HEADER,
  candidateFromCsvRecord,
  formatCsvLine,
  parseCsv,
  parseCsvRecords,
  questionFromCsvRecord,
  questionToCsvRecord,
} from "../csvFormats.js";
import { CreateQuestionRequestSchema } from "../question.js";

const rows: Record<
  string,
  Partial<Record<(typeof QUESTION_CSV_HEADER)[number], string>>
> = {
  single_choice: {
    tipo: "single_choice",
    enunciado: "2+2",
    opciones: "3|4|5",
    respuesta: "B",
    dificultad: "1",
    etiquetas: "mate",
  },
  multiple_choice: {
    tipo: "multiple_choice",
    enunciado: "Primos",
    opciones: "2|3|4",
    respuesta: "A|B",
    dificultad: "2",
    etiquetas: "mate|primos",
  },
  true_false: {
    tipo: "true_false",
    enunciado: "Sol",
    respuesta: "verdadero",
    dificultad: "1",
  },
  fill_blank: {
    tipo: "fill_blank",
    enunciado: "Capital ____",
    respuesta: "París",
    dificultad: "1",
  },
  text_response: {
    tipo: "text_response",
    enunciado: "Explicá",
    criterio: "Evaporación",
    dificultad: "3",
  },
  likert: {
    tipo: "likert",
    enunciado: "Acuerdo",
    opciones: "Claro|Útil",
    respuesta: "1|3",
    columnas: "Sí|Neutral|No",
    dificultad: "1",
  },
  ranking: {
    tipo: "ranking",
    enunciado: "Ordená",
    opciones: "1|5|10",
    dificultad: "2",
  },
};

describe("question CSV codec", () => {
  it.each(Object.entries(rows))(
    "%s: import is valid and export round-trips",
    (_type, row) => {
      const parsed = CreateQuestionRequestSchema.safeParse(
        questionFromCsvRecord(row),
      );
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      const q = parsed.data!;
      const exported = questionToCsvRecord({
        type: q.type,
        content: q.content ?? "",
        options: (q.options ?? []).map((o) => ({
          id: o.id,
          content: o.content ?? "",
        })),
        standardAnswer: q.standardAnswer,
        scale: q.scale ?? null,
        rubric: q.rubric ?? null,
        difficulty: q.difficulty,
        tags: q.tags ?? [],
      });
      const again = CreateQuestionRequestSchema.parse(
        questionFromCsvRecord(exported),
      );
      expect(again.type).toBe(q.type);
      expect(again.options).toEqual(q.options);
      expect(again.standardAnswer).toEqual(q.standardAnswer);
      expect(again.scale ?? null).toEqual(q.scale ?? null);
      expect(again.tags).toEqual(q.tags);
    },
  );

  it("maps answers to option ids", () => {
    expect(questionFromCsvRecord(rows.multiple_choice!).standardAnswer).toEqual(
      ["A", "B"],
    );
    expect(questionFromCsvRecord(rows.true_false!).standardAnswer).toBe(true);
    expect(questionFromCsvRecord(rows.likert!).standardAnswer).toEqual({
      A: 0,
      B: 2,
    });
    expect(questionFromCsvRecord(rows.ranking!).standardAnswer).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("rejects an unknown type through the request schema", () => {
    expect(
      CreateQuestionRequestSchema.safeParse(
        questionFromCsvRecord({ tipo: "essay", enunciado: "x" }),
      ).success,
    ).toBe(false);
  });
});

describe("CSV parsing", () => {
  it("handles quoted commas, quotes and newlines", () => {
    const line = formatCsvLine(["a,b", 'di "hola"', "dos\nlíneas"]);
    expect(parseCsv(`${line}\n`)).toEqual([
      ["a,b", 'di "hola"', "dos\nlíneas"],
    ]);
  });

  it("strips the export's formula guard", () => {
    const { records } = parseCsvRecords(
      "legajo,nombre,contraseña\n'-5,'=SUMA,x",
      CANDIDATE_CSV_HEADER,
    );
    expect(candidateFromCsvRecord(records[0]!)).toEqual({
      username: "-5",
      name: "=SUMA",
      password: "x",
    });
  });
});
