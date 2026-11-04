import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  detectDuplicate,
  parseImportCsv,
} from "./candidateImport";

describe("parseImportCsv", () => {
  it("reads legajo,nombre,contraseña rows", () => {
    const result = parseImportCsv(
      'legajo,nombre,contraseña\nA001,Ana Pérez,secreto123\nA002,"Gómez, Luis",\n',
    );
    expect(result.missingColumns).toEqual([]);
    expect(result.rows).toEqual([
      { username: "A001", name: "Ana Pérez", password: "secreto123" },
      { username: "A002", name: "Gómez, Luis" },
    ]);
  });

  it("matches the header ignoring case, accents and column order", () => {
    const result = parseImportCsv(
      "Nombre,CONTRASENA,Legajo\r\nAna,pw123456,A1",
    );
    expect(result.rows).toEqual([
      { username: "A1", name: "Ana", password: "pw123456" },
    ]);
  });

  it("reads the file the export produces (BOM, no password)", () => {
    const result = parseImportCsv(
      "\uFEFFlegajo,nombre,contraseña\r\nA1,Ana,\r\n",
    );
    expect(result.rows).toEqual([{ username: "A1", name: "Ana" }]);
  });

  it("accepts a file without the contraseña column", () => {
    const result = parseImportCsv("legajo,nombre\nA1,Ana");
    expect(result.missingColumns).toEqual([]);
    expect(result.rows).toEqual([{ username: "A1", name: "Ana" }]);
  });

  it("reports missing required columns", () => {
    expect(parseImportCsv("username,name\nA1,Ana").missingColumns).toEqual([
      "legajo",
      "nombre",
    ]);
  });

  it("truncates at MAX_IMPORT_ROWS", () => {
    const lines = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, i) => `L${i},N${i},`,
    );
    const result = parseImportCsv(
      `legajo,nombre,contraseña\n${lines.join("\n")}`,
    );
    expect(result.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.truncated).toBe(true);
    expect(result.totalLines).toBe(MAX_IMPORT_ROWS + 1);
  });
});

describe("detectDuplicate", () => {
  it("matches by legajo", () => {
    const row = { username: "A1", name: "Ana" };
    expect(detectDuplicate(row, [{ username: "A1" }])).toBe(true);
    expect(detectDuplicate(row, [{ username: "A2" }])).toBe(false);
  });
});
