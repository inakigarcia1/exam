import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { AttemptDetailPage } from "./AttemptDetailPage";
import { permissionsForRole } from "@exam/authz";
import type { AssignableRole } from "@exam/contracts";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly details?: unknown;
    readonly requestId?: string;
    readonly serverMessage?: string;
    constructor(
      status: number,
      message: string,
      code?: string,
      details?: unknown,
      requestId?: string,
      serverMessage?: string,
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.message = message;
      this.code = code;
      this.details = details;
      this.requestId = requestId;
      this.serverMessage = serverMessage ?? message;
    }
  },
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  setNavigate: () => {},
}));

function renderPage(
  attemptId = "attempt-1",
  actor: { role: AssignableRole; capabilities: string[] } = {
    role: "Admin",
    capabilities: [...permissionsForRole("Admin")],
  },
) {
  return render(
    <MemoryRouter initialEntries={[`/admin/attempts/${attemptId}`]}>
      <AuthProvider
        initialUser={{
          id: "1",
          username: "actor",
          name: "Actor",
          role: actor.role,
          organizationId: "org1",
          capabilities: actor.capabilities,
        }}
      >
        <BrandProvider>
          <Routes>
            <Route path="/admin/attempts/:id" element={<AttemptDetailPage />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const mockGradedResult = {
  attemptId: "attempt-1",
  status: "graded" as const,
  showResultImmediately: true as const,
  examTitle: "期末考试",
  passingScore: 60,
  totalScore: 100,
  passed: true,
  gradedAt: new Date().toISOString(),
  questionResults: [
    {
      questionId: "q1",
      score: 10,
      maxScore: 10,
      correct: true,
      candidateAnswer: "A",
      standardAnswer: "A",
      type: "single_choice",
      content: "Question 1",
      order: 1,
    },
    {
      questionId: "q2",
      score: 5,
      maxScore: 10,
      correct: false,
      candidateAnswer: "B",
      standardAnswer: "A",
      type: "single_choice",
      content: "Question 2",
      order: 2,
    },
  ],
};

describe("AttemptDetailPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it("displays earned score (sum of question scores) not totalScore", async () => {
    apiGet.mockResolvedValue(mockGradedResult);
    renderPage();

    await screen.findByText("Resumen de la calificación");

    const earnedScoreEl = screen.getByTestId("earned-score");
    expect(earnedScoreEl).toHaveTextContent("15");

    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows green for passed, red for failed", async () => {
    apiGet.mockResolvedValue({ ...mockGradedResult, passed: true });
    renderPage();
    await screen.findByText("Resumen de la calificación");

    const earnedScoreEl = screen.getByTestId("earned-score");
    // The status color lives on an inner span (the type-metric recipe owns
    // color on the outer element; the pass/fail state color is applied to the
    // text span so it does not conflict with the recipe).
    expect(earnedScoreEl.querySelector("span")!.className).toContain(
      "text-success",
    );

    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("shows destructive color for failed attempt", async () => {
    apiGet.mockResolvedValue({ ...mockGradedResult, passed: false });
    renderPage();
    await screen.findByText("Resumen de la calificación");

    const earnedScoreEl = screen.getByTestId("earned-score");
    expect(earnedScoreEl.querySelector("span")!.className).toContain(
      "text-destructive",
    );

    expect(screen.getByText("No aprobado")).toBeInTheDocument();
  });

  it("shows passing score", async () => {
    apiGet.mockResolvedValue(mockGradedResult);
    renderPage();
    await screen.findByText("Resumen de la calificación");
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("shows status-specific message when result is submitted (not graded)", async () => {
    apiGet.mockResolvedValue({
      attemptId: "attempt-1",
      status: "submitted",
      showResultImmediately: false,
      examTitle: "期末考试",
    });
    renderPage();
    expect(
      await screen.findByText("Este intento ya se entregó. Falta la corrección."),
    ).toBeInTheDocument();
  });

  it("shows status-specific message when graded but not visible", async () => {
    apiGet.mockResolvedValue({
      attemptId: "attempt-1",
      status: "graded",
      showResultImmediately: false,
      examTitle: "期末考试",
    });
    renderPage();
    expect(
      await screen.findByText("Este intento ya está corregido, pero la calificación todavía no está publicada."),
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    apiGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    apiGet.mockRejectedValue(new Error("fail"));
    renderPage();
    expect(await screen.findByText("No se pudo cargar el detalle del intento")).toBeInTheDocument();
  });

  it("renders question results table", async () => {
    apiGet.mockResolvedValue(mockGradedResult);
    renderPage();
    await screen.findByText("Detalle de las respuestas");
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.getAllByText("A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("B").length).toBeGreaterThanOrEqual(1);
  });

  it("renders question type labels from shared constants", async () => {
    apiGet.mockResolvedValue({
      ...mockGradedResult,
      questionResults: [
        ...mockGradedResult.questionResults,
        {
          questionId: "q3",
          score: 8,
          maxScore: 10,
          correct: true,
          candidateAnswer: "foo",
          standardAnswer: "foo",
          type: "fill_blank",
          content: "Question 3",
          order: 3,
        },
      ],
    });
    renderPage();
    await screen.findByText("Detalle de las respuestas");
    expect(screen.getAllByText("Opción única").length).toBe(2);
    expect(screen.getByText("Completar")).toBeInTheDocument();
  });

  // --- Timeline section (P2E-J2) ---
  // api.get is called twice per page load (result + timeline). Route the mock
  // by URL so each fetch resolves to the right payload.

  function mockTimelineResult(
    result: unknown,
    timeline: { events: unknown[] },
  ) {
    apiGet.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/timeline")) {
        return timeline;
      }
      return result;
    });
  }

  const mockTimelineEvents = {
    events: [
      {
        id: "e1",
        organizationId: "org1",
        actorId: "cand-1",
        action: "attempt.start",
        targetType: "attempt",
        targetId: "attempt-1",
        metadata: { source: "candidate" },
        ipAddress: null,
        userAgent: null,
        createdAt: "2026-06-23T08:00:00.000Z",
      },
      {
        id: "e2",
        organizationId: "org1",
        actorId: "admin-1",
        action: "attempt.forceSubmit",
        targetType: "attempt",
        targetId: "attempt-1",
        metadata: { reason: "proctor" },
        ipAddress: "10.0.0.1",
        userAgent: "test",
        createdAt: "2026-06-23T08:30:00.000Z",
      },
    ],
  };

  it("renders the timeline section with human-readable event labels", async () => {
    mockTimelineResult(mockGradedResult, mockTimelineEvents);
    renderPage();
    await screen.findByText("Línea de tiempo del intento");
    // attempt.start -> Empezar a responder, attempt.forceSubmit -> Entrega forzada por un administrador
    expect(await screen.findByText("Empezar a responder")).toBeInTheDocument();
    expect(screen.getByText("Entrega forzada por un administrador")).toBeInTheDocument();
  });

  it("renders grant_time timeline event with a Chinese label, not the raw key", async () => {
    mockTimelineResult(mockGradedResult, {
      events: [
        {
          id: "e-grant",
          organizationId: "org1",
          actorId: "admin-1",
          action: "grant_time",
          targetType: "attempt",
          targetId: "attempt-1",
          metadata: { addedSeconds: 600 },
          ipAddress: null,
          userAgent: null,
          createdAt: "2026-06-23T08:10:00.000Z",
        },
      ],
    });
    renderPage();
    await screen.findByText("Línea de tiempo del intento");
    // The localized label is rendered, never the raw action key.
    expect(await screen.findByText("Otorgar tiempo de examen")).toBeInTheDocument();
    expect(screen.queryByText("grant_time")).not.toBeInTheDocument();
  });

  it("shows empty state when timeline has no events", async () => {
    mockTimelineResult(mockGradedResult, { events: [] });
    renderPage();
    await screen.findByText("Línea de tiempo del intento");
    expect(await screen.findByText("Todavía no hay eventos")).toBeInTheDocument();
  });

  it("shows timeline error fallback when timeline fetch rejects", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/timeline")) {
        throw new Error("timeline fail");
      }
      return mockGradedResult;
    });
    renderPage();
    expect(await screen.findByText("No se pudo cargar la línea de tiempo")).toBeInTheDocument();
  });

  it("expands event metadata when an event row is clicked", async () => {
    mockTimelineResult(mockGradedResult, mockTimelineEvents);
    renderPage();
    await screen.findByText("Línea de tiempo del intento");
    const startLabel = await screen.findByText("Empezar a responder");
    fireEvent.click(startLabel);
    // metadata JSON for the start event contains "source".
    expect(await screen.findByText(/source/)).toBeInTheDocument();
  });

  // ── P3-MOD-P3-3: Admin frozen result view ────────────────────────
  // AttemptDetailPage consumes the admin all-view DTO
  // (GET /api/admin/attempts/:id/result). The server bypasses the publication
  // gate on that surface and keeps standardAnswer, so the DTO carries
  // showResultImmediately:true + standardAnswer even when the candidate result
  // is pending_publish. This test proves the page renders the
  // full admin frozen detail (score/pass + objective standardAnswer) purely from
  // that DTO — it never fetches live questions and never hides based on
  // candidate publication state.
  it("renders full admin frozen result (score/pass + standardAnswer) from the admin scores DTO", async () => {
    apiGet.mockResolvedValue({
      attemptId: "attempt-1",
      status: "graded",
      showResultImmediately: true,
      examTitle: "P3-3 admin frozen",
      passingScore: 20,
      totalScore: 30,
      passed: true,
      gradedAt: new Date().toISOString(),
      questionResults: [
        {
          questionId: "q-obj",
          score: 10,
          maxScore: 10,
          correct: true,
          candidateAnswer: "a",
          standardAnswer: "a",
          type: "single_choice",
          content: "P3-3 objective prompt",
          order: 0,
        },
        {
          questionId: "q-text",
          score: 15,
          maxScore: 20,
          correct: true,
          candidateAnswer: "candidate essay",
          standardAnswer: "P3-3 frozen reference answer",
          type: "text_response",
          content: "P3-3 essay prompt",
          order: 1,
        },
      ],
    });
    renderPage();

    await screen.findByText("Resumen de la calificación");
    // Admin aggregate score + pass render (candidate publication is irrelevant
    // to the admin view — the DTO gate is the page's only input).
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
    expect(screen.getByText("P3-3 objective prompt")).toBeInTheDocument();
    expect(screen.getByText("P3-3 essay prompt")).toBeInTheDocument();
    // The objective frozen standardAnswer is rendered for the admin (the server
    // does not strip it for Admin, unlike the candidate projection).
    expect(screen.getAllByText("a").length).toBeGreaterThan(0);
  });

  // ── #524: misconduct flag must carry a dialog-frozen operationId ────────
  // The route contract (MisconductMarkWithOperationRequestSchema) requires
  // operationId; the stale caller posted {severity, notes} and the API always
  // answered 400 VALIDATION_ERROR. One logical dialog command = one
  // operationId: minted on dialog open, retained across same-dialog retries,
  // retired on close/confirm.

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const mockLiveResult = {
    attemptId: "attempt-1",
    status: "in_progress",
    showResultImmediately: false,
    examTitle: "进行中考试",
  };

  function mockLiveView() {
    apiGet.mockImplementation(async (url: string) =>
      typeof url === "string" && url.includes("/timeline")
        ? { events: [] }
        : mockLiveResult,
    );
  }

  async function renderLiveView() {
    mockLiveView();
    renderPage();
    await screen.findByText("Estado del intento");
  }

  async function submitFlag(notes = "考生查看手机") {
    fireEvent.click(screen.getByRole("button", { name: "Marcar irregularidad" }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: notes },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
  }

  async function waitSubmitSettled() {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled(),
    );
  }

  function postedBody(call: number): Record<string, unknown> {
    return apiPost.mock.calls[call]![1] as Record<string, unknown>;
  }

  it("T1: flag misconduct POST carries operationId (uuid) with severity + notes", async () => {
    apiPost.mockResolvedValue({});
    await renderLiveView();
    await submitFlag();

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost.mock.calls[0]![0]).toBe(
      "/api/admin/attempts/attempt-1/misconduct",
    );
    const body = postedBody(0);
    expect(body.operationId).toMatch(UUID_RE);
    expect(body).toMatchObject({ severity: "warning", notes: "考生查看手机" });
  });

  it("T2: same-dialog retry after unconfirmed failure reuses the same operationId", async () => {
    apiPost.mockResolvedValue({});
    apiPost.mockRejectedValueOnce(new Error("network drop"));
    await renderLiveView();
    await submitFlag();
    await waitSubmitSettled();

    // The failure keeps the dialog open; the retry is the SAME logical
    // command and must replay the SAME identity.
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));

    expect(postedBody(0).operationId).toMatch(UUID_RE);
    expect(postedBody(1).operationId).toBe(postedBody(0).operationId);
  });

  it("T3: a new dialog after cancel mints a fresh operationId", async () => {
    apiPost.mockRejectedValue(new Error("network drop"));
    await renderLiveView();
    await submitFlag();
    await waitSubmitSettled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar irregularidad" }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "第二次标记" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));

    expect(postedBody(0).operationId).toMatch(UUID_RE);
    expect(postedBody(1).operationId).toMatch(UUID_RE);
    expect(postedBody(1).operationId).not.toBe(postedBody(0).operationId);
  });

  it("T4: payload semantics unchanged — endpoint, severity, notes", async () => {
    apiPost.mockResolvedValue({});
    await renderLiveView();
    await submitFlag("考试作弊记录");

    expect(apiPost.mock.calls[0]![0]).toBe(
      "/api/admin/attempts/attempt-1/misconduct",
    );
    expect(postedBody(0)).toMatchObject({
      severity: "warning",
      notes: "考试作弊记录",
    });
  });

  // ── #612: capability composition closure ──────────────────────────
  // Route reachability (attempt.timeline.view) and sub-feature authority are
  // distinct capabilities. The load-bearing assertion for a Proctor-like set
  // is NOT merely "button hidden" — it is "button hidden AND the unauthorized
  // privileged request never emitted".

  const proctorActor: { role: AssignableRole; capabilities: string[] } = {
    role: "Proctor",
    capabilities: [...permissionsForRole("Proctor")],
  };

  function mockTimelineOnly(timeline: { events: unknown[] }) {
    apiGet.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/timeline")) {
        return timeline;
      }
      // Any non-timeline GET (i.e. the score read) is a contract violation
      // for the timeline-only caller — fail loudly instead of returning data.
      throw new Error(`unexpected privileged request: ${url}`);
    });
  }

  // Regression for #612: capability-set-driven action affordances on the
  // admin attempt timeline.
  it("Proctor-like set renders the timeline shell and never emits the score/export/misconduct requests", async () => {
    mockTimelineOnly(mockTimelineEvents);
    renderPage("attempt-1", proctorActor);

    // The timeline surface (the legitimate base page) renders with events.
    expect(await screen.findByText("Línea de tiempo del intento")).toBeInTheDocument();
    expect(await screen.findByText("Empezar a responder")).toBeInTheDocument();

    // The result fetch was never issued — page reachability must not mint a
    // guaranteed-403 request.
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(1);
    });
    expect(apiGet.mock.calls[0]![0]).toBe(
      "/api/admin/attempts/attempt-1/timeline",
    );
    expect(apiPost).not.toHaveBeenCalled();

    // Privileged affordances are absent alongside their requests.
    expect(
      screen.queryByRole("button", { name: "Exportar CSV" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Exportar JSON" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar irregularidad" }),
    ).not.toBeInTheDocument();
    // The shell keeps navigation (and is not stuck on the result loading state).
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("divergent capability set (score read without export/misconduct) still composes each sub-feature independently", async () => {
    // A Proctor-LABELED actor whose set additionally holds the score-read
    // capability: proves composition follows the capability set, not the role
    // name — timeline + score read held, export + misconduct not.
    const divergentActor: { role: AssignableRole; capabilities: string[] } = {
      role: "Proctor",
      capabilities: ["attempt.timeline.view", "score.all.view"],
    };
    apiGet.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/timeline")) {
        return { events: [] };
      }
      return mockLiveResult;
    });
    renderPage("attempt-1", divergentActor);

    // Score-capable caller: the live status view renders (the authorized
    // request WAS issued and composed).
    expect(await screen.findByText("Estado del intento")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/api/admin/attempts/attempt-1/result",
      );
    });

    // The un-held sub-features stay absent.
    expect(
      screen.queryByRole("button", { name: "Exportar CSV" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar irregularidad" }),
    ).not.toBeInTheDocument();
  });

  it("Admin keeps the export affordances on the live view", async () => {
    mockTimelineResult(mockLiveResult, { events: [] });
    renderPage();

    expect(await screen.findByText("Estado del intento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exportar JSON" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar irregularidad" }),
    ).toBeInTheDocument();
  });
});
