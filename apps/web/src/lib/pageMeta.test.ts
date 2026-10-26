import { describe, expect, it } from "vitest";
import {
  getFallbackPageTitle,
  getFallbackProductName,
  getDocumentTitle,
  getPageTitle,
} from "@/lib/pageMeta";
import { routes } from "@/lib/routes";

describe("page metadata", () => {
  it("returns static admin route titles", () => {
    expect(getPageTitle("/admin/dashboard")).toBe("Panel");
    expect(getPageTitle("/admin/settings")).toBe("Configuración de la plataforma");
    expect(getPageTitle("/admin/recovery")).toBe("Revisión de recuperación");
    expect(getPageTitle("/admin/proctor/recovery")).toBe("Resolución de supervisión");
    expect(getPageTitle("/admin/permissions")).toBe("Registro de permisos");
    expect(getPageTitle("/admin/exam-profiles")).toBe("Plantillas de reglas");
    expect(getPageTitle("/admin/exam-profiles/new")).toBe("Nueva plantilla de política");
    expect(getPageTitle("/exam/settings")).toBe("Configuración de la cuenta");
  });

  it("returns public identity page titles", () => {
    expect(getPageTitle(routes.inviteAccept)).toBe("Activar cuenta");
    expect(getPageTitle(routes.forgotPassword)).toBe("Recuperar contraseña");
    expect(getPageTitle(routes.resetPassword)).toBe("Restablecer contraseña");
  });

  it("returns the grading queue title for its registered route", () => {
    expect(getPageTitle(routes.admin.gradingQueue)).toBe("Por calificar");
  });

  it("resolves the grading queue title through trailing-slash normalization", () => {
    expect(getPageTitle(`${routes.admin.gradingQueue}/`)).toBe("Por calificar");
  });

  it("builds the grading queue document title from the same authority", () => {
    expect(getDocumentTitle(routes.admin.gradingQueue, "测评平台")).toBe(
      "Por calificar - 测评平台",
    );
  });

  it("returns candidate-facing route titles", () => {
    expect(getPageTitle("/exam/list")).toBe("Mis exámenes");
    expect(getPageTitle("/exam/exam-1/start")).toBe("Preparación del examen");
    expect(getPageTitle("/exam/attempt-1/take")).toBe("Examen en curso");
    expect(getPageTitle("/exam/attempt-1/result")).toBe("Resultado del examen");
  });

  it("returns dynamic admin route titles", () => {
    expect(getPageTitle("/admin/exams/exam-1")).toBe("Detalle del examen");
    expect(getPageTitle("/admin/exams/exam-1/scores")).toBe("Lista de calificaciones");
    expect(getPageTitle("/admin/questions/question-1/edit")).toBe("Editar pregunta");
    expect(getPageTitle("/admin/attempts/attempt-1")).toBe("Detalle de las respuestas");
    expect(getPageTitle("/admin/recovery/incidents/incident-1")).toBe(
      "Detalle del incidente",
    );
    expect(getPageTitle("/admin/recovery/attempts/attempt-1")).toBe(
      "Operaciones del intento",
    );
    expect(getPageTitle("/admin/recovery/exams/exam-1")).toBe("Recuperación del examen");
  });

  it("resolves the newly registered dynamic page titles", () => {
    expect(getPageTitle("/admin/grading-queue/attempt-1")).toBe("Calificación manual");
    expect(getPageTitle("/admin/exams/exam-1/edit")).toBe("Editar examen");
    expect(getPageTitle("/admin/exam-profiles/profile-1/edit")).toBe(
      "Editar plantilla de política",
    );
  });

  it("keeps sub-page routes from resolving to the generic exam detail rule", () => {
    // Dynamic rules are $-anchored: the detail pattern must never swallow
    // /edit, /scores or /proctor siblings.
    expect(getPageTitle("/admin/exams/exam-1/edit")).not.toBe("Detalle del examen");
    expect(getPageTitle("/admin/exams/exam-1/scores")).not.toBe("Detalle del examen");
    expect(getPageTitle("/admin/exams/exam-1/proctor")).not.toBe("Detalle del examen");
    expect(getPageTitle("/admin/exams/exam-1/proctor/monitor")).not.toBe(
      "Detalle del examen",
    );
  });

  it("returns a stable fallback page title", () => {
    expect(getPageTitle("/admin/unknown")).toBe(getFallbackPageTitle());
  });

  it("builds document titles with product fallback", () => {
    expect(getDocumentTitle("/admin/dashboard", "测评平台")).toBe(
      "Panel - 测评平台",
    );
    expect(getDocumentTitle("/admin/dashboard", "  ")).toBe(
      `Panel - ${getFallbackProductName()}`,
    );
  });
});
