import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { loginAsAdmin } from "../lib/login";
import { adminApiToken, adminPost, adminGet } from "../lib/flow";

/**
 * #785 BDD acceptance — L3: REAL browser + REAL API + REAL PostgreSQL
 * (no request interception of the routes under test).
 *
 * Scenario source: docs/design/admin-list-pagination-bdd.md.
 * Covered here: B01 (records beyond the first page are reachable by paging),
 * B02 (the keyword candidate is reachable via server-side search from page 1),
 * B04 (the results overview lists the server-filtered status set with real
 * pagination), B05 (the view-scores action obeys the server-computed
 * canViewScores, not the status alone) and B13 (course search matches the
 * description on the server).
 *
 * Determinism contract: every seeded record carries a per-run unique stamp,
 * so assertions never depend on baseline data left by previous runs (the
 * exam_e2e database is persistent). Page walks are event-synced on the
 * list responses and bounded by the server's own totalPages for the same
 * query — no sleeps, no fixed page cap, no assumed global page position.
 */

const STAMP = Date.now().toString(36);
/** Unique search keyword for the candidate seeded beyond the first page. */
const KEYWORD = `zebra${STAMP}`;
/** Unique keyword carried ONLY in a course's description (B13). */
const DESC_KEYWORD = `descword${STAMP}`;
/** The 21 seeded exams, title → unique. */
const EXAM_TITLES = Array.from(
  { length: 21 },
  (_, i) => `BDD785${STAMP} Exámenes ${String(i + 1).padStart(2, "0")}`,
);

async function seedCandidate(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<void> {
  const res = await adminPost(request, token, "/api/candidates", {
    username: `e2e-bdd785-${STAMP}-${name}`,
    password: "candidate123",
    name,
    fields: { candidateNo: `E2E-BDD785-${STAMP}-${name}` },
  });
  expect(
    res.ok(),
    `seed candidate failed: ${res.status()} ${await res.text()}`,
  ).toBe(true);
}

/** Seeds one published exam (course + question + exam + publish), like seedExam. */
async function seedPublishedExam(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<void> {
  const courseCode = `BDD785-${STAMP}-${title}`;
  const course = await adminPost(request, token, "/api/courses", {
    name: title,
    code: courseCode,
    description: "",
  });
  expect(course.ok(), await course.text()).toBe(true);
  const courseId = ((await course.json()) as { id: string }).id;

  const question = await adminPost(request, token, "/api/questions", {
    type: "true_false",
    content: `${title} Verdadero o falso`,
    standardAnswer: true,
    score: 10,
  });
  expect(question.ok(), await question.text()).toBe(true);
  const questionId = ((await question.json()) as { id: string }).id;

  const exam = await adminPost(request, token, "/api/exams", {
    title,
    courseId,
    durationMinutes: 60,
    openAt: new Date(Date.now() - 3_600_000).toISOString(),
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    passingScore: 6,
    totalScore: 10,
    questionIds: [questionId],
  });
  expect(exam.ok(), await exam.text()).toBe(true);
  const examId = ((await exam.json()) as { id: string }).id;

  const publish = await adminPost(
    request,
    token,
    `/api/exams/${examId}/publish`,
  );
  expect(publish.ok(), await publish.text()).toBe(true);
}

/** Fetches the server-declared page count for a list query. This is the
 * explicit fixture premise that bounds the UI walk — no fixed page cap, and
 * no assumption about how much baseline data the reseeded database holds. */
async function fetchTotalPages(
  request: APIRequestContext,
  token: string,
  listUrl: string,
): Promise<number> {
  const res = await adminGet(request, token, listUrl);
  expect(res.ok(), await res.text()).toBe(true);
  const body = (await res.json()) as { totalPages: number };
  expect(body.totalPages).toBeGreaterThanOrEqual(1);
  return body.totalPages;
}

/** Walks the list pages of a table view, collecting visible texts. Page 0 is
 * the already-loaded first page; every further page turn syncs on BOTH the
 * list API response AND the footer's rendered range line (the HTTP response
 * alone does not guarantee React has committed the new page). `maxPages`
 * comes from the server's own totalPages for the same query. */
async function walkAllPages(
  page: Page,
  apiPath: string,
  wanted: string[],
  maxPages: number,
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    if (pageNumber > 0) {
      const next = page.getByRole("button", { name: "Página siguiente" });
      if (await next.isDisabled().catch(() => true)) break;
      const responsePromise = page.waitForResponse((r) =>
        r.url().includes(apiPath),
      );
      await next.click();
      await responsePromise;
      // The footer range is the rendered page fact: "显示 <start>-<end> 条".
      const start = pageNumber * 20 + 1;
      await page
        .getByText(new RegExp(`显示 ${start}-`))
        .waitFor({ timeout: 10_000 });
    }
    for (const title of wanted) {
      if (found.has(title)) continue;
      const cell = page
        .getByRole("table")
        .getByText(title, { exact: true })
        .first();
      if ((await cell.count()) > 0 && (await cell.isVisible())) {
        found.add(title);
      }
    }
    if (found.size === wanted.length) break;
    const next = page.getByRole("button", { name: "Página siguiente" });
    if (await next.isDisabled().catch(() => true)) break;
  }
  return found;
}

test.describe
  .serial("admin list pagination / search / status (#785 BDD L3)", () => {
  let adminToken: string;

  test("seed >20 records through the real API", async ({ request }) => {
    adminToken = await adminApiToken(request);

    // Sanity: the routes under test answer with the documented pagination
    // contract before any UI is involved.
    const list = await adminGet(
      request,
      adminToken,
      "/api/exams?page=1&pageSize=20",
    );
    expect(list.ok()).toBe(true);
    const body = (await list.json()) as {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);

    // 22 candidates: 21 fillers push the collection past the first page and
    // one keyword candidate beyond it (B02).
    for (let i = 0; i < 21; i += 1) {
      await seedCandidate(
        request,
        adminToken,
        `Alumno${STAMP}x${String(i + 1).padStart(2, "0")}`,
      );
    }
    await seedCandidate(request, adminToken, `Alumno${STAMP} ${KEYWORD}`);

    // 21 published exams push both /admin/exams and the results overview
    // past the first page (B01/B04).
    for (const title of EXAM_TITLES) {
      await seedPublishedExam(request, adminToken, title);
    }

    // B13 fixture: a course whose description — and only its description —
    // carries DESC_KEYWORD (name/code deliberately do not).
    const descCourse = await adminPost(request, adminToken, "/api/courses", {
      name: `普通课程${STAMP}`,
      code: `ORD-${STAMP}`,
      description: `课程简介 ${DESC_KEYWORD} Único`,
    });
    expect(descCourse.ok(), await descCourse.text()).toBe(true);
  });

  test("B01/B02: candidates page — pagination reaches beyond page 1 and search finds the seeded record", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/candidates");
    await expect(page.getByRole("table")).toBeVisible();

    // The collection is beyond one page: real pagination controls show.
    await expect(page.getByText(/共 \d+ 条/)).toBeVisible();
    const next = page.getByRole("button", { name: "Página siguiente" });
    await expect(next).toBeEnabled();

    // Paging forward renders the second page's range line (B01). No
    // assumption is made about WHERE a given seeded record sits in the
    // global ordering — that depends on the reseed baseline, not the
    // fixture; the footer range is the observed paging fact.
    const responsePromise = page.waitForResponse((r) =>
      r.url().includes("/api/candidates"),
    );
    await next.click();
    await responsePromise;
    await expect(page.getByText(/显示 21-/)).toBeVisible();

    // Server-side search finds the keyword candidate from wherever the
    // browser currently is — no need to page to the end first (B02).
    const searchBox = page.getByLabel("Buscar alumnos");
    await searchBox.fill(KEYWORD);
    const searchResponse = page.waitForResponse((r) =>
      r.url().includes(`search=${KEYWORD}`),
    );
    await searchBox.press("Enter");
    await searchResponse;

    const table = page.getByRole("table");
    await expect(
      table.getByText(`Alumno${STAMP} ${KEYWORD}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/共 1 条/)).toBeVisible();

    // Clearing restores the full-set pagination.
    await page
      .getByRole("button", { name: "Borrar búsqueda de alumnos" })
      .click();
    await expect
      .poll(() => page.getByText(/共 \d+ 条/).textContent())
      .not.toContain("共 1 条");
    await expect(
      page.getByRole("button", { name: "Página siguiente" }),
    ).toBeEnabled();
  });

  test("B01: exams page — all 21 seeded exams are reachable across pages", async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/exams");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Página siguiente" }),
    ).toBeEnabled();

    const expectedPages = await fetchTotalPages(
      request,
      adminToken,
      "/api/exams?page=1&pageSize=20",
    );
    const found = await walkAllPages(
      page,
      "/api/exams",
      EXAM_TITLES,
      expectedPages,
    );
    expect(
      found.size,
      `reachable ${found.size}/21 — every seeded exam must be reachable by paging`,
    ).toBe(EXAM_TITLES.length);
  });

  test("B13: courses page — search matches the course description on the server", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/courses");
    await expect(page.getByRole("table")).toBeVisible();

    const searchBox = page.getByLabel("Buscar comisiones");
    await searchBox.fill(DESC_KEYWORD);
    const searchResponse = page.waitForResponse((r) =>
      r.url().includes(`search=${DESC_KEYWORD}`),
    );
    await searchBox.press("Enter");
    await searchResponse;

    // The course matches by description alone; exactly one row answers.
    await expect(
      page.getByRole("table").getByText(`普通课程${STAMP}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/共 1 条/)).toBeVisible();
  });

  test("B04/B05: results overview — server status set paginates and view-scores obeys canViewScores", async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/results");
    await expect(page.getByRole("table")).toBeVisible();

    // The overview requests the SERVER-filtered status set (B04) — verified
    // on the wire, not by client-side filtering.
    const overviewRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/api/exams") &&
        r.url().includes("statuses=published%2Copen%2Cclosed%2Carchived"),
    );
    await page.reload();
    await overviewRequest;

    // 21 newly published exams ⇒ the filtered set spans pages.
    await expect(
      page.getByRole("button", { name: "Página siguiente" }),
    ).toBeEnabled();

    const expectedPages = await fetchTotalPages(
      request,
      adminToken,
      "/api/exams?page=1&pageSize=20&statuses=published%2Copen%2Cclosed%2Carchived",
    );
    const found = await walkAllPages(
      page,
      "/api/exams",
      EXAM_TITLES,
      expectedPages,
    );
    expect(found.size, `overview reachable ${found.size}/21`).toBe(
      EXAM_TITLES.length,
    );

    // B05: a published, not-yet-ended exam must show its status but keep the
    // score action disabled (server canViewScores=false), with a reason. The
    // walk ends on the LAST page — assert on the newest seeded exam, whose
    // row is guaranteed to be in view there.
    const row = page
      .getByRole("row")
      .filter({ hasText: EXAM_TITLES[EXAM_TITLES.length - 1]! })
      .first();
    await expect(row.getByText("Publicado")).toBeVisible();
    const viewScores = row.getByRole("button", { name: "Ver calificación" });
    await expect(viewScores).toBeDisabled();
  });
});
