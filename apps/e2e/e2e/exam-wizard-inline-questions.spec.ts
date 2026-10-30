import { test, expect, type Page } from "@playwright/test";
import { adminApiToken, adminPost } from "../lib/flow";
import { loginViaUi } from "../lib/login";
import {
  assignTeacherToCourse,
  createTeacherViaApi,
  teacherApiToken,
} from "../lib/teacher";

/**
 * Real browser + real API + real PostgreSQL.
 *
 * A Teacher builds an exam in the wizard: one question is created inline in
 * step 3 (stored in the shared bank), another is added from the bank, the two
 * are reordered, the draft is created, and the draft preview opens in a new
 * tab showing both questions in the chosen order and no answer key.
 */

const STAMP = Date.now().toString(36);
const SUBJECT = `Materia wizard ${STAMP}`;
const COMMISSION = `Comisión wizard ${STAMP}`;
const BANK_PROMPT = `Pregunta del banco ${STAMP}`;
const INLINE_PROMPT = `Pregunta creada en el examen ${STAMP}`;
const EXAM_TITLE = `Examen wizard ${STAMP}`;

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function pickOption(page: Page, comboboxName: string, option: string) {
  await page.getByRole("combobox", { name: comboboxName, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

function localDateTime(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

test("teacher creates an exam with inline + bank questions, reorders, and previews it", async ({
  page,
  request,
}) => {
  const adminToken = await adminApiToken(request);

  const subjectRes = await adminPost(request, adminToken, "/api/subjects", {
    name: SUBJECT,
  });
  expect(subjectRes.ok(), await subjectRes.text()).toBe(true);
  const subjectId = ((await subjectRes.json()) as { id: string }).id;

  const courseRes = await adminPost(request, adminToken, "/api/courses", {
    name: COMMISSION,
    description: "",
    subjectId,
  });
  expect(courseRes.ok(), await courseRes.text()).toBe(true);
  const courseId = ((await courseRes.json()) as { id: string }).id;

  const bankRes = await adminPost(request, adminToken, "/api/questions", {
    type: "true_false",
    content: BANK_PROMPT,
    standardAnswer: true,
    score: 1,
  });
  expect(bankRes.ok(), await bankRes.text()).toBe(true);
  const bankQuestionId = ((await bankRes.json()) as { id: string }).id;

  const teacher = await createTeacherViaApi(request, {
    usernamePrefix: "e2e-wizard",
  });
  await assignTeacherToCourse(request, teacher, courseId);
  await loginViaUi(page, teacher.username, teacher.password, /\/admin\/exams$/);

  await page.goto("/admin/exams/new");

  // Step 1 — basic data.
  await page.locator("#wiz-title").fill(EXAM_TITLE);
  await pickOption(page, "Materia", SUBJECT);
  await pickOption(page, "Comisión", COMMISSION);
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Step 2 — policy defaults.
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Step 3 — inline question, then one from the bank.
  await page.getByRole("button", { name: "Nueva pregunta" }).click();
  await pickOption(page, "Tipo de pregunta", "Verdadero o falso");
  await page.getByPlaceholder("Escribí el enunciado").fill(INLINE_PROMPT);
  const createdQuestion = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" && res.url().endsWith("/api/questions"),
  );
  await page.getByRole("button", { name: "Guardar pregunta" }).click();
  const createdRes = await createdQuestion;
  expect(createdRes.status()).toBe(201);
  const inlineQuestionId = ((await createdRes.json()) as { id: string }).id;
  await expect(page.getByText("Preguntas elegidas (1)")).toBeVisible();

  await page.getByRole("button", { name: "Agregar del banco" }).click();
  const bankDialog = page.getByRole("dialog");
  await bankDialog
    .getByRole("row")
    .filter({ hasText: BANK_PROMPT })
    .getByRole("button", { name: "Agregar" })
    .click();
  await bankDialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByText("Preguntas elegidas (2)")).toBeVisible();

  // Reorder: move the bank question above the inline one.
  await page
    .getByRole("listitem")
    .filter({ hasText: BANK_PROMPT })
    .getByRole("button", { name: "Subir pregunta" })
    .click();
  const cards = page.getByRole("listitem").filter({ hasText: STAMP });
  await expect(cards.nth(0)).toContainText(BANK_PROMPT);
  await expect(cards.nth(1)).toContainText(INLINE_PROMPT);
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Step 4 — schedule.
  await page.locator("#wiz-openAt").fill(localDateTime(60 * 60_000));
  await page.locator("#wiz-closeAt").fill(localDateTime(24 * 60 * 60_000));
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Step 5 — create the draft.
  const createdExam = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" && res.url().endsWith("/api/exams"),
  );
  await page.getByRole("button", { name: "Crear borrador" }).click();
  const examRes = await createdExam;
  expect(examRes.status(), await examRes.text()).toBe(201);
  const examId = ((await examRes.json()) as { id: string }).id;
  await page.waitForURL(new RegExp(`/admin/exams/${examId}$`));

  const teacherToken = await teacherApiToken(request, teacher);
  const examDetail = await request.get(`${BASE_URL}/api/exams/${examId}`, {
    headers: { Cookie: `auth-token=${teacherToken}` },
  });
  expect(examDetail.ok()).toBe(true);
  expect(
    ((await examDetail.json()) as { questionIds: string[] }).questionIds,
  ).toEqual([bankQuestionId, inlineQuestionId]);

  // Preview opens in a new tab.
  const popupPromise = page.context().waitForEvent("page");
  await page.getByRole("link", { name: "Vista previa" }).click();
  const preview = await popupPromise;
  await preview.waitForLoadState("domcontentloaded");
  await expect(preview).toHaveURL(new RegExp(`/preview/exams/${examId}$`));

  await expect(
    preview.getByText(
      "Vista previa. Así ve el examen un alumno. Las respuestas no se guardan.",
    ),
  ).toBeVisible();
  await expect(preview.getByText(BANK_PROMPT)).toBeVisible();
  await expect(preview.getByText(INLINE_PROMPT)).toHaveCount(0);
  await preview.getByRole("button", { name: "Pregunta siguiente" }).click();
  await expect(preview.getByText(INLINE_PROMPT)).toBeVisible();
  await expect(preview.getByText("Respuesta correcta")).toHaveCount(0);
  await expect(preview.getByTestId("true-false-true")).not.toBeChecked();

  await preview.screenshot({
    path: test.info().outputPath("exam-wizard-preview.png"),
    fullPage: true,
  });
});
