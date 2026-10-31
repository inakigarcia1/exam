import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { ExamListPage } from "./ExamListPage";

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
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

function makeExam(overrides: Record<string, unknown>) {
  return {
    examId: "exam-1",
    title: "Test Exam",
    windowStartAt: "2026-05-01T00:00:00.000Z",
    windowEndAt: "2026-05-01T01:00:00.000Z",
    durationMinutes: 60,
    passingScore: 60,
    totalScore: 100,
    totalQuestions: 5,
    attemptsUsed: 0,
    maxAttempts: 3,
    latestAttemptId: undefined as string | undefined,
    latestAttemptStatus: undefined as string | undefined,
    bestScore: undefined as number | undefined,
    bestScorePercent: undefined as number | undefined,
    availabilityStatus: "available" as const,
    primaryAction: "start" as const,
    ...overrides,
  };
}

describe("ExamListPage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("renders available exam with start button in Exámenes actuales section", async () => {
    getMock.mockResolvedValue([makeExam({})]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Exámenes actuales")).toBeInTheDocument();
    expect(screen.getByText("Comenzar examen")).toBeInTheDocument();
  });

  it("renders in_progress exam with resume button", async () => {
    getMock.mockResolvedValue([
      makeExam({
        availabilityStatus: "in_progress",
        primaryAction: "resume",
        latestAttemptId: "att-1",
        attemptsUsed: 1,
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Continuar examen")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("renders resumable exam with resume button", async () => {
    getMock.mockResolvedValue([
      makeExam({
        availabilityStatus: "resumable",
        primaryAction: "resume",
        latestAttemptId: "att-1",
        attemptsUsed: 1,
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Continuar examen")).toBeInTheDocument();
    expect(screen.getByText("Para retomar")).toBeInTheDocument();
  });

  it("renders graded exam with bestScore badge", async () => {
    getMock.mockResolvedValue([
      makeExam({
        availabilityStatus: "graded",
        primaryAction: "view_result",
        bestScore: 85,
        bestScorePercent: 85,
        attemptsUsed: 1,
        latestAttemptId: "att-1",
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Calificado")).toBeInTheDocument();
    const scoreBadge = screen.getByTestId("exam-best-score");
    expect(scoreBadge).toBeInTheDocument();
    expect(scoreBadge).toHaveTextContent("85");
    expect(screen.getByText("Ver calificación")).toBeInTheDocument();
    expect(screen.getByTestId("exam-primary-action")).toHaveAttribute(
      "data-action",
      "view_result",
    );
  });

  it("renders max_attempts_exhausted in Exámenes anteriores section", async () => {
    getMock.mockResolvedValue([
      makeExam({
        examId: "exam-exhaust",
        availabilityStatus: "max_attempts_exhausted",
        primaryAction: "view_result",
        attemptsUsed: 3,
        maxAttempts: 3,
        latestAttemptId: "att-2",
        bestScore: 90,
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
          <Route
            path="/exam/:attemptId/result"
            element={<div>考试结果页</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Exámenes actuales")).not.toBeInTheDocument();
    expect(await screen.findByText("Exámenes anteriores")).toBeInTheDocument();
    expect(screen.getByText("Intentos agotados")).toBeInTheDocument();
    expect(screen.getByText("Ver calificación")).toBeInTheDocument();
  });

  it("splits exams into current and previous sections by state", async () => {
    getMock.mockResolvedValue([
      makeExam({ examId: "e-available", title: "Disponible" }),
      makeExam({
        examId: "e-progress",
        title: "En curso",
        availabilityStatus: "in_progress",
        primaryAction: "resume",
        latestAttemptId: "att-p",
        attemptsUsed: 1,
      }),
      makeExam({
        examId: "e-graded",
        title: "Calificado",
        availabilityStatus: "graded",
        primaryAction: "view_result",
        latestAttemptId: "att-g",
        attemptsUsed: 1,
        bestScore: 70,
      }),
      makeExam({
        examId: "e-closed",
        title: "Cerrado sin rendir",
        availabilityStatus: "closed",
        primaryAction: "none",
      }),
    ]);
    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const current = (
      await screen.findByRole("heading", { name: "Exámenes actuales" })
    ).closest("section")!;
    const history = screen
      .getByRole("heading", { name: "Exámenes anteriores" })
      .closest("section")!;

    expect(current).toContainElement(
      screen.getByTestId("exam-card-e-available"),
    );
    expect(current).toContainElement(
      screen.getByTestId("exam-card-e-progress"),
    );
    expect(history).toContainElement(screen.getByTestId("exam-card-e-graded"));
    expect(history).toContainElement(screen.getByTestId("exam-card-e-closed"));

    const closedCard = screen.getByTestId("exam-card-e-closed");
    expect(closedCard).toHaveTextContent("Cerrado");
    expect(closedCard).toHaveTextContent("Este examen está cerrado");
    expect(closedCard).not.toHaveTextContent("Para aprobar");
    expect(
      closedCard.querySelector("[data-testid='exam-primary-action']"),
    ).toBeNull();
  });

  it("shows empty state when no exams", async () => {
    getMock.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No hay exámenes disponibles"),
    ).toBeInTheDocument();
  });

  // Characterization (UI-MIGRATE-N-W3): each section heading introduces a
  // page-level group of exam cards and must remain present as a heading
  // tied to its card group after the section-title typography migration.
  // Asserts the durable role, not the raw typography class.
  it("keeps the Exámenes actuales heading as a section title over its card group", async () => {
    getMock.mockResolvedValue([makeExam({})]);
    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const heading = await screen.findByRole("heading", {
      name: "Exámenes actuales",
    });
    expect(heading.tagName).toBe("H2");
    const section = heading.closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("Test Exam");
  });

  it("keeps the Exámenes anteriores heading as a section title over its card group", async () => {
    getMock.mockResolvedValue([
      makeExam({
        examId: "exam-exhaust",
        availabilityStatus: "max_attempts_exhausted",
        primaryAction: "view_result",
        attemptsUsed: 3,
        maxAttempts: 3,
        latestAttemptId: "att-2",
        bestScore: 90,
      }),
    ]);
    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const heading = await screen.findByRole("heading", {
      name: "Exámenes anteriores",
    });
    expect(heading.tagName).toBe("H2");
    const section = heading.closest("section");
    expect(section).toBeInTheDocument();
  });

  // Characterization (UI-MIGRATE-N-W4B): the exam card is a Card-primitive
  // container that owns its elevation. After the business `shadow-sm` is
  // removed (the Card primitive already supplies it), the card must remain a
  // single `data-slot="card"` region holding the title, metadata, and primary
  // action. Asserts the durable container role, not the raw shadow token.
  it("keeps each exam card as a Card region holding title, metadata, and action", async () => {
    getMock.mockResolvedValue([makeExam({})]);
    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("exam-card-exam-1");
    const card = screen.getByTestId("exam-card-exam-1");
    // The exam card renders as the Card primitive container.
    expect(card).toHaveAttribute("data-slot", "card");
    // The card region still holds the exam title, its meta, and the action.
    expect(card).toHaveTextContent("Test Exam");
    expect(card).toHaveTextContent("60");
    expect(card).toHaveTextContent("Comenzar examen");
  });

  it("shows error state on load failure", async () => {
    getMock.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter initialEntries={["/exam/list"]}>
        <Routes>
          <Route path="/exam/list" element={<ExamListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No se pudo cargar la lista de exámenes"),
    ).toBeInTheDocument();
  });
});
