import { describe, expect, it, beforeAll, afterAll } from "vitest";
import questionRoutes from "./question.js";
import courseRoutes from "./course.js";
import { buildTestApp, uniquePrefix } from "./testHelpers.js";
import { QUESTION_CSV_HEADER, parseCsvRecords } from "@exam/contracts";

describe("question routes", () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let courseId: string;

  beforeAll(async () => {
    ctx = await buildTestApp(async (fastify) => {
      await fastify.register(courseRoutes);
      await fastify.register(questionRoutes);
    });

    const courseRes = await ctx.app.inject({
      method: "POST",
      url: "/api/courses",
      payload: {
        name: "Q Course",
        code: `QC-${uniquePrefix()}`,
        description: "",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    courseId = courseRes.json().id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("POST /api/questions creates a single_choice question", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "single_choice",
        content: "What is 1+1?",
        options: [
          { id: "a", content: "1" },
          { id: "b", content: "2", isCorrect: true },
          { id: "c", content: "3" },
        ],
        standardAnswer: "b",
        difficulty: 1,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toBe("single_choice");
    expect(body.content).toBe("What is 1+1?");
    expect(body).toHaveProperty("id");
  });

  it("likert persists its scale; switching type must clear it", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "likert",
        content: "Rate",
        options: [
          { id: "A", content: "Statement 1" },
          { id: "B", content: "Statement 2" },
        ],
        scale: ["No", "Maybe", "Yes"],
        standardAnswer: { A: 0, B: 2 },
        difficulty: 1,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.scale).toEqual(["No", "Maybe", "Yes"]);

    const keepScale = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { type: "single_choice", standardAnswer: "A" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(keepScale.statusCode).toBe(400);

    const cleared = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { type: "single_choice", standardAnswer: "A", scale: null },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().scale).toBeNull();
  });

  it("POST /api/questions creates a ranking question in the authored order", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "ranking",
        content: "Order",
        options: [
          { id: "A", content: "First" },
          { id: "B", content: "Second" },
        ],
        standardAnswer: ["A", "B"],
        difficulty: 1,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().standardAnswer).toEqual(["A", "B"]);
  });

  it("POST /api/questions creates a true_false question", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "The sky is blue.",
        standardAnswer: true,
        difficulty: 1,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().type).toBe("true_false");
  });

  it("POST /api/questions rejects single_choice with standardAnswer: null", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "single_choice",
        content: "Discuss the trade-offs in detail.",
        options: [
          { id: "a", content: "Option A" },
          { id: "b", content: "Option B" },
        ],
        standardAnswer: null,
        difficulty: 3,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const fields = body.error.details.fields as Array<{ field: string }>;
    expect(fields.some((f) => f.field === "standardAnswer")).toBe(true);
  });

  it("POST /api/questions creates a fill_blank question", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "fill_blank",
        content: "The capital of France is ____.",
        standardAnswer: "Paris",
        difficulty: 2,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().type).toBe("fill_blank");
  });

  it("POST /api/questions creates a multiple_choice question", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "multiple_choice",
        content: "Select even numbers.",
        options: [
          { id: "a", content: "1" },
          { id: "b", content: "2", isCorrect: true },
          { id: "c", content: "3" },
          { id: "d", content: "4", isCorrect: true },
        ],
        standardAnswer: ["b", "d"],
        difficulty: 2,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().type).toBe("multiple_choice");
  });

  it("GET /api/questions returns list", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions",
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
    expect(body.items.length).toBeGreaterThanOrEqual(4);
  });

  it("GET /api/questions filters by type", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions?type=single_choice",
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.every((q: any) => q.type === "single_choice")).toBe(true);
  });

  it("GET /api/questions filters by server-side content search (case-insensitive, substring)", async () => {
    // Seed a known question so the search assertion does not depend on the
    // execution order of other tests in this file.
    const needle = "Photosynthesis produces OXYGEN and glucose.";
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "single_choice",
        content: needle,
        options: [
          { id: "a", content: "A" },
          { id: "b", content: "B", isCorrect: true },
        ],
        standardAnswer: "b",
        difficulty: 2,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);

    // Lowercase substring of the mixed-case content.
    const lower = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?search=produces+oxygen`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(lower.statusCode).toBe(200);
    const lowerBody = lower.json();
    expect(lowerBody.items.length).toBeGreaterThan(0);
    expect(lowerBody.total).toBe(lowerBody.items.length);
    expect(
      lowerBody.items.every((q: any) =>
        q.content.toLowerCase().includes("produces oxygen"),
      ),
    ).toBe(true);

    // Same term in UPPER must match the same rows (case-insensitivity).
    const upper = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?search=PRODUCES+OXYGEN`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(upper.statusCode).toBe(200);
    expect(upper.json().total).toBe(lowerBody.total);

    // A search term that matches nothing returns an empty page, total 0.
    // NB: the term uses ILIKE metacharacters (_) deliberately — they must be
    // treated as literals, NOT single-char wildcards, or this would match the
    // seeded row above (each _ absorbing one char).
    const none = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?search=__no_such_content_zzz__`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(none.statusCode).toBe(200);
    expect(none.json().total).toBe(0);
    expect(none.json().items).toEqual([]);
  });

  it("GET /api/questions treats empty/whitespace search as no-op", async () => {
    const base = await ctx.app.inject({
      method: "GET",
      url: `/api/questions`,
      cookies: { "auth-token": ctx.adminToken },
    });
    const empty = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?search=`,
      cookies: { "auth-token": ctx.adminToken },
    });
    const ws = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?search=%20%20`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(base.json().total).toBe(empty.json().total);
    expect(base.json().total).toBe(ws.json().total);
  });

  it("GET /api/questions/:id returns single question", async () => {
    const listRes = await ctx.app.inject({
      method: "GET",
      url: "/api/questions",
      cookies: { "auth-token": ctx.adminToken },
    });
    const first = listRes.json().items[0];

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${first.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(first.id);
  });

  it("PATCH /api/questions/:id updates a question", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "To update.",
        standardAnswer: true,
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { content: "Updated content." },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().content).toBe("Updated content.");
  });

  // ── #437: update validates the MERGED final state, not just the patch ──

  it("PATCH rejects clearing the standardAnswer of an auto-graded question", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "fill_blank",
        content: "The answer is ____",
        standardAnswer: "abc",
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { standardAnswer: null },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    const fields = body.error.details.fields as Array<{ field: string }>;
    expect(fields.some((f) => f.field === "standardAnswer")).toBe(true);
  });

  it("PATCH rejects a type-only transition into auto grading without an answer", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "The answer is ____",
        standardAnswer: null,
        rubric: "Rubric",
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    // The payload carries only `type`; the merged state is fill_blank + null
    // answer, which must be rejected even though the patch itself has no
    // standardAnswer field.
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { type: "fill_blank" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    const fields = body.error.details.fields as Array<{ field: string }>;
    expect(fields.some((f) => f.field === "standardAnswer")).toBe(true);
  });

  it("PATCH accepts a simultaneous transition into auto grading with a valid answer", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "The answer is ____",
        standardAnswer: null,
        rubric: "Rubric",
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { type: "fill_blank", standardAnswer: "answer" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().type).toBe("fill_blank");
    expect(res.json().standardAnswer).toBe("answer");
  });

  it("PATCH preserves text_response with standardAnswer: null", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "Explain your reasoning.",
        standardAnswer: null,
        rubric: "Rubric",
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { standardAnswer: null },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().standardAnswer).toBeNull();
  });

  it("PATCH rejects an incompatible stored answer across auto types", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "The answer is ____",
        standardAnswer: true,
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    // Stored answer `true` is invalid for fill_blank; the final merged state
    // must be rejected even though the patch carries no answer.
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { type: "fill_blank" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    const fields = body.error.details.fields as Array<{ field: string }>;
    expect(fields.some((f) => f.field === "standardAnswer")).toBe(true);
  });

  it("DELETE /api/questions/:id deletes a question", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "To delete.",
        standardAnswer: false,
        score: 5,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "DELETE",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(204);
  });

  it("POST /api/questions rejects true_false with non-boolean answer", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "Bad answer type.",
        standardAnswer: "yes",
        score: 10,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/questions returns 401 without auth", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions",
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("AUTH_REQUIRED");
    expect(body.error.requestId).toBeDefined();
  });

  it("GET /api/questions/:id returns 404 ErrorResponse v0 for missing question", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions/00000000-0000-0000-0000-000000000000",
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.error.requestId).toBeDefined();
  });

  it("DELETE /api/questions/:id returns 404 ErrorResponse v0 for missing question", async () => {
    const res = await ctx.app.inject({
      method: "DELETE",
      url: "/api/questions/00000000-0000-0000-0000-000000000000",
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.error.requestId).toBeDefined();
  });

  const csvRow = (row: Record<string, string>) => ({
    tipo: "",
    enunciado: "",
    opciones: "",
    respuesta: "",
    columnas: "",
    criterio: "",
    dificultad: "",
    etiquetas: "",
    ...row,
  });

  it("POST /api/questions/import validates CSV records of every type", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: {
        rows: [
          csvRow({
            tipo: "single_choice",
            enunciado: "Import Q1?",
            opciones: "A|B|C",
            respuesta: "B",
          }),
          csvRow({
            tipo: "multiple_choice",
            enunciado: "Import Q2?",
            opciones: "A|B|C",
            respuesta: "A|C",
          }),
          csvRow({
            tipo: "true_false",
            enunciado: "Import Q3?",
            respuesta: "verdadero",
          }),
          csvRow({
            tipo: "fill_blank",
            enunciado: "Import ____?",
            respuesta: "x",
          }),
          csvRow({
            tipo: "text_response",
            enunciado: "Import Q5?",
            criterio: "Rubric",
          }),
          csvRow({
            tipo: "likert",
            enunciado: "Import Q6?",
            opciones: "R1|R2",
            respuesta: "1|2",
            columnas: "Sí|No",
          }),
          csvRow({
            tipo: "ranking",
            enunciado: "Import Q7?",
            opciones: "1|2|3",
          }),
        ],
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.details).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ status: "error" }),
      ]),
    );
    expect(body.total).toBe(7);
    expect(body.valid).toBe(7);
  });

  it("POST /api/questions/import with confirm=true persists a log and returns logId", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: {
        confirm: true,
        rows: [
          csvRow({
            tipo: "true_false",
            enunciado: "Confirm log Q?",
            respuesta: "verdadero",
          }),
        ],
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(1);
    expect(body.logId).toEqual(expect.any(String));
  });

  it("POST /api/questions/import without confirm does not return logId", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: {
        rows: [
          csvRow({
            tipo: "true_false",
            enunciado: "Preview Q?",
            respuesta: "falso",
          }),
        ],
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.logId).toBeUndefined();
  });

  it("GET /api/questions/export returns a CSV that imports back with the same answers", async () => {
    const prefix = uniquePrefix();
    const rows = [
      csvRow({
        tipo: "single_choice",
        enunciado: `${prefix} sc`,
        opciones: "=1+1|B",
        respuesta: "B",
        etiquetas: "x|y",
      }),
      csvRow({
        tipo: "likert",
        enunciado: `${prefix} lk`,
        opciones: "R1|R2",
        respuesta: "2|1",
        columnas: "Sí|No",
      }),
      csvRow({ tipo: "ranking", enunciado: `${prefix} rk`, opciones: "c|a|b" }),
    ];
    const imported = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: { confirm: true, rows },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(imported.json().valid).toBe(3);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions/export",
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const { records } = parseCsvRecords(res.body, QUESTION_CSV_HEADER);
    const mine = records.filter((r) => r.enunciado.startsWith(prefix));
    expect(mine).toEqual(rows.map((r) => ({ ...r, dificultad: "3" })));
  });

  it("GET /api/questions/export requires authentication", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/questions/export",
    });
    expect(res.statusCode).toBe(401);
  });

  // ── rubric production write/read path closure ─────────
  // Proves the historical gap is fixed: rubric flows through POST/PATCH
  // routes (not just repo/contract) and survives a real DB round-trip.

  it("POST /api/questions persists a text_response rubric and returns it", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "请阐述你的观点",
        standardAnswer: null,
        difficulty: 3,
        rubric: "按逻辑完整性、关键概念、论证质量给分",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toBe("text_response");
    expect(body.rubric).toBe("按逻辑完整性、关键概念、论证质量给分");
    expect(body.id).toBeDefined();
  });

  it("GET /api/questions/:id returns the persisted text_response rubric", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "返回读取测试",
        standardAnswer: null,
        score: 10,
        rubric: "Award full credit for a correct logical chain",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rubric).toBe(
      "Award full credit for a correct logical chain",
    );
  });

  it("PATCH /api/questions/:id persists rubric updates", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "待更新 rubric 的题",
        standardAnswer: null,
        score: 15,
        rubric: "初始评分标准",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { rubric: "更新后的评分标准" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().rubric).toBe("更新后的评分标准");

    // Re-read through GET to prove the value is persisted, not just echoed.
    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().rubric).toBe("更新后的评分标准");
  });

  it("PATCH /api/questions/:id without rubric field preserves the persisted rubric", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "省略 rubric 字段的 PATCH 测试",
        standardAnswer: null,
        score: 12,
        rubric: "Original rubric",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    // PATCH with an unrelated mutable field, omitting rubric entirely,
    // so the update path executes without touching the rubric key.
    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { content: "Updated content, rubric field omitted" },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(patchRes.statusCode).toBe(200);

    // Independent readback through the production GET path.
    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().rubric).toBe("Original rubric");
  });

  it("PATCH /api/questions/:id with rubric=null clears the persisted rubric", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "text_response",
        content: "显式 null 清空 rubric 测试",
        standardAnswer: null,
        score: 12,
        rubric: "Original rubric",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${created.id}`,
      payload: { rubric: null },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(patchRes.statusCode).toBe(200);

    // Independent readback through the production GET path; do not infer
    // correctness from the PATCH response alone.
    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().rubric).toBeNull();
  });

  it("GET /api/questions list projects rubric (null for objective questions)", async () => {
    // Objective question created without rubric → null semantics.
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "rubric null semantics marker question",
        standardAnswer: true,
        score: 2,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/questions/${created.id}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rubric).toBeNull();
  });

  it("POST /api/questions/import persists a text_response row with rubric", async () => {
    const previewRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: {
        confirm: true,
        rows: [
          csvRow({
            tipo: "text_response",
            enunciado: "Pregunta de desarrollo importada",
            criterio: "Criterio importado",
          }),
        ],
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(previewRes.statusCode).toBe(200);
    const body = previewRes.json();
    expect(body.valid).toBe(1);
    expect(body.errors).toBe(0);

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/questions?type=text_response`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(listRes.statusCode).toBe(200);
    const items = listRes.json().items as Array<{
      content: string;
      rubric: string | null;
    }>;
    const imported = items.find(
      (q) => q.content === "Pregunta de desarrollo importada",
    );
    expect(imported?.rubric).toBe("Criterio importado");
  });

  it("POST /api/questions/import reports errors for invalid rows", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions/import",
      payload: {
        rows: [
          csvRow({
            tipo: "single_choice",
            enunciado: "Valid row",
            opciones: "A|B",
            respuesta: "A",
          }),
          csvRow({
            tipo: "fill_blank",
            enunciado: "No placeholder.",
            respuesta: "x",
          }),
          csvRow({ tipo: "essay", enunciado: "Unknown type" }),
        ],
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.valid).toBe(1);
    expect(body.errors).toBe(2);
    expect(body.details[1].status).toBe("error");
    expect(body.details[2].status).toBe("error");
  });

  // ── MVP question creation proof — type-specific readback ──
  // Proves each type's canonical fields are PERSISTED and read back through
  // the production GET path (not just echoed in the create response), and
  // that no type leaks rubric (objective) or options/standardAnswer
  // (text_response). text_response multiline rubric readback is additionally
  // proven above; this block closes the per-type persistence gap for the
  // objective options/answer shapes that the older create tests only
  // asserted via statusCode + type.
  it("persists and reads back type-specific fields per question type", async () => {
    const cases = [
      {
        name: "single_choice",
        payload: {
          type: "single_choice",
          content: "rb single content",
          options: [
            { id: "a", content: "A" },
            { id: "b", content: "B" },
          ],
          standardAnswer: "a",
          score: 10,
        },
        check: (body: Record<string, unknown>) => {
          expect(body.standardAnswer).toBe("a");
          expect(body.options).toEqual([
            { id: "a", content: "A", contentDocument: null },
            { id: "b", content: "B", contentDocument: null },
          ]);
          expect(body.rubric).toBeNull();
        },
      },
      {
        name: "multiple_choice",
        payload: {
          type: "multiple_choice",
          content: "rb multi content",
          options: [
            { id: "a", content: "1" },
            { id: "b", content: "2" },
            { id: "c", content: "3" },
          ],
          standardAnswer: ["a", "c"],
          score: 10,
        },
        // Array answer must round-trip as an array, not collapse to a string.
        check: (body: Record<string, unknown>) => {
          expect(body.standardAnswer).toEqual(["a", "c"]);
          expect(body.rubric).toBeNull();
        },
      },
      {
        name: "true_false",
        payload: {
          type: "true_false",
          content: "rb true_false content",
          standardAnswer: false,
          score: 5,
        },
        // Canonical boolean representation preserved through persistence.
        check: (body: Record<string, unknown>) => {
          expect(body.standardAnswer).toBe(false);
          expect(body.rubric).toBeNull();
        },
      },
      {
        name: "fill_blank",
        payload: {
          type: "fill_blank",
          content: "rb fill ____ content",
          standardAnswer: "Paris",
          score: 10,
          gradingRule: {
            multiSelectScoring: "all_correct_full",
            fillBlankMatchMode: "keyword",
          },
        },
        check: (body: Record<string, unknown>) => {
          expect(body.standardAnswer).toBe("Paris");
          expect(body.rubric).toBeNull();
        },
      },
      {
        name: "text_response",
        payload: {
          type: "text_response",
          content: "rb text_response content",
          options: [],
          standardAnswer: null,
          rubric: "rb 关键概念\nrb 论证完整",
          score: 20,
        },
        check: (body: Record<string, unknown>) => {
          // Multiline rubric preserved verbatim; no objective fields leak.
          expect(body.rubric).toBe("rb 关键概念\nrb 论证完整");
          expect(body.standardAnswer).toBeNull();
          expect(body.options).toEqual([]);
        },
      },
    ] as const;

    for (const c of cases) {
      const createRes = await ctx.app.inject({
        method: "POST",
        url: "/api/questions",
        payload: { ...c.payload } as Record<string, unknown>,
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(createRes.statusCode, `create ${c.name}`).toBe(201);
      const created = createRes.json();

      // Independent readback via production GET — proves persistence, not echo.
      const getRes = await ctx.app.inject({
        method: "GET",
        url: `/api/questions/${created.id}`,
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(getRes.statusCode, `readback ${c.name}`).toBe(200);
      const body = getRes.json() as Record<string, unknown>;
      expect(body.type, `type ${c.name}`).toBe(c.payload.type);
      c.check(body);
    }
  });

  // Reject a multiple_choice payload whose array answer references a
  // non-existent option — the multi-choice counterpart to the existing
  // single_choice non-option rejection. Uses the current contract only.
  it("POST /api/questions rejects multiple_choice with a non-option answer", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "multiple_choice",
        content: "Bad multi answer.",
        options: [
          { id: "a", content: "A" },
          { id: "b", content: "B" },
        ],
        standardAnswer: ["a", "zzz"],
        score: 10,
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
  });

  // Structured tag filter vocabulary endpoint (issue #182): distinct, sorted,
  // org-scoped, authenticated. The admin UI consumes this to enumerate tags
  // truthfully instead of deriving them from the paginated list rows.
  describe("GET /api/questions/tags", () => {
    it("returns the distinct sorted tag vocabulary of the org", async () => {
      const mk = async (content: string, tags: string[]) =>
        ctx.app.inject({
          method: "POST",
          url: "/api/questions",
          payload: {
            type: "true_false",
            content,
            standardAnswer: true,
            difficulty: 1,
            tags,
          },
          cookies: { "auth-token": ctx.adminToken },
        });
      const r1 = await mk("Tag vocab question one", ["beta", "alpha"]);
      const r2 = await mk("Tag vocab question two", ["alpha", "gamma"]);
      expect(r1.statusCode).toBe(201);
      expect(r2.statusCode).toBe(201);

      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/questions/tags",
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(res.statusCode).toBe(200);
      const { tags } = res.json() as { tags: string[] };
      expect(tags).toContain("alpha");
      expect(tags).toContain("beta");
      expect(tags).toContain("gamma");
      // distinct: alpha appears once; sorted ascending.
      expect(tags.filter((t) => t === "alpha")).toHaveLength(1);
      const sortedCopy = [...tags].sort();
      expect(tags).toEqual(sortedCopy);
    });

    it("requires authentication", async () => {
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/questions/tags",
      });
      expect(res.statusCode).toBe(401);
    });

    it("does not shadow GET /api/questions/:id (uuid route still works)", async () => {
      const listRes = await ctx.app.inject({
        method: "GET",
        url: "/api/questions?page=1&pageSize=1",
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(listRes.statusCode).toBe(200);
      const first = listRes.json().items[0];
      const byId = await ctx.app.inject({
        method: "GET",
        url: `/api/questions/${first.id}`,
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(byId.statusCode).toBe(200);
    });
  });

  // Canonical tag grammar (issue #182): every tag the write contract accepts
  // must round-trip through the comma-separated GET /questions?tags= filter.
  describe("tag grammar round-trip", () => {
    const mkQuestion = async (content: string, tags: string[]) =>
      ctx.app.inject({
        method: "POST",
        url: "/api/questions",
        payload: {
          type: "true_false",
          content,
          standardAnswer: true,
          difficulty: 1,
          tags,
        },
        cookies: { "auth-token": ctx.adminToken },
      });

    it("normalizes padded/duplicate/empty tags on create and stores them filterable", async () => {
      const res = await mkQuestion("Round-trip normalized tags", [
        " 代数 ",
        "代数",
        "",
        "几何",
      ]);
      expect(res.statusCode).toBe(201);
      expect(res.json().tags).toEqual(["代数", "几何"]);

      const byTag = await ctx.app.inject({
        method: "GET",
        url: `/api/questions?page=1&pageSize=50&tags=${encodeURIComponent("代数")}`,
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(byTag.statusCode).toBe(200);
      const items = byTag.json().items as Array<{
        content: string;
        tags: string[];
      }>;
      expect(
        items.some((q) => q.content === "Round-trip normalized tags"),
      ).toBe(true);
      expect(items.every((q) => q.tags.includes("代数"))).toBe(true);
    });

    it("rejects comma-containing tags on create (cannot round-trip)", async () => {
      const res = await mkQuestion("Comma tag rejected", ["代数,几何"]);
      expect(res.statusCode).toBe(400);
      expect(res.json().error?.code).toBe("VALIDATION_ERROR");
    });

    it("rejects comma-containing tags on update", async () => {
      const created = await mkQuestion("Update comma rejection", ["ok"]);
      expect(created.statusCode).toBe(201);
      const id = created.json().id as string;

      const res = await ctx.app.inject({
        method: "PATCH",
        url: `/api/questions/${id}`,
        payload: { tags: ["bad,comma"] },
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error?.code).toBe("VALIDATION_ERROR");
    });

    it("import splits pipe-separated tags, drops empties, and stores them filterable", async () => {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/questions/import",
        payload: {
          confirm: true,
          rows: [
            csvRow({
              tipo: "true_false",
              enunciado: "Import tag round-trip",
              respuesta: "verdadero",
              etiquetas: "Importar| |Otra",
            }),
          ],
        },
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toBe(0);
      expect(res.json().valid).toBe(1);

      const byTag = await ctx.app.inject({
        method: "GET",
        url: `/api/questions?page=1&pageSize=50&tags=${encodeURIComponent("Importar")}`,
        cookies: { "auth-token": ctx.adminToken },
      });
      expect(byTag.statusCode).toBe(200);
      const items = byTag.json().items as Array<{ content: string }>;
      expect(items.some((q) => q.content === "Import tag round-trip")).toBe(
        true,
      );
    });
  });
});
