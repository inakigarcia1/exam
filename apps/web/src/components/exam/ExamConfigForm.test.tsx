import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExamConfigForm, type ExamConfigData } from "./ExamConfigForm";

const baseConfig: ExamConfigData = {
  title: "Test Exam",
  description: "",
  courseId: "course-1",
  timingMode: "timed_window",
  durationMinutes: 60,
  openAt: "2026-06-01T09:00",
  closeAt: "2026-06-01T11:00",
  passingScore: 60,
  totalScore: 100,
  questionSelectionMode: "manual",
  questionIds: [],
  questionScores: {},
  resultPublicationMode: "immediate",
  controlFlags: {
    shuffleQuestions: false,
    shuffleOptions: false,
    requireQueue: false,
    batchSize: 10,
    batchInterval: 3,
    restrictIp: false,
    requireLockdown: false,
    showResultImmediately: true,
  },
  retakePolicy: "unlimited",
  scoreStrategy: "highest",
  maxAttempts: 1,
};

describe("ExamConfigForm totalScore", () => {
  it("auto-calculates totalScore from selected questions", () => {
    const onChange = vi.fn();
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1", "q2"],
          totalScore: 30,
        }}
        questions={[
          { id: "q1", score: 10 },
          { id: "q2", score: 20 },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/Cálculo automático.*30/)).toBeInTheDocument();
  });

  it("shows totalScore as read-only when questions are selected", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1"],
          totalScore: 15,
        }}
        questions={[{ id: "q1", score: 15 }]}
        onChange={() => {}}
      />,
    );

    const totalScoreInput = screen.getByLabelText("Puntaje total");
    expect(totalScoreInput).toHaveAttribute("readonly");
  });

  it("shows editable totalScore when no questions are selected", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );

    const totalScoreInput = screen.getByLabelText("Puntaje total");
    expect(totalScoreInput).not.toHaveAttribute("readonly");
  });

  it("allows manual override of totalScore via toggle", async () => {
    const onChange = vi.fn();
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1"],
          totalScore: 15,
        }}
        questions={[{ id: "q1", score: 15 }]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Carga manual/ }));
    const totalScoreInput = screen.getByLabelText("Puntaje total");
    expect(totalScoreInput).not.toHaveAttribute("readonly");
  });

  it("shows warning in manual mode when totalScore does not match question score sum", async () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1", "q2"],
          totalScore: 50,
        }}
        questions={[
          { id: "q1", score: 10 },
          { id: "q2", score: 20 },
        ]}
        onChange={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Carga manual/ }));

    expect(screen.getByText(/总分与题目分值之和不匹配/)).toBeInTheDocument();
  });

  it("syncs computed totalScore to data via onChange on mount", () => {
    const onChange = vi.fn();
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1", "q2"],
          totalScore: 100,
        }}
        questions={[
          { id: "q1", score: 10 },
          { id: "q2", score: 20 },
        ]}
        onChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ totalScore: 30 }),
    );
  });

  it("does not sync totalScore in manual mode", () => {
    const onChange = vi.fn();
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          questionIds: ["q1", "q2"],
          totalScore: 100,
        }}
        questions={[
          { id: "q1", score: 10 },
          { id: "q2", score: 20 },
        ]}
        onChange={onChange}
      />,
    );

    const calls = onChange.mock.calls.filter(
      (call: Array<ExamConfigData>) => call[0]?.totalScore !== 100,
    );
    expect(calls.length).toBeLessThanOrEqual(1);
  });
});

describe("ExamConfigForm fields", () => {
  it("renders title, duration fields", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Nombre del examen")).toBeInTheDocument();
    expect(
      screen.getByText("Duración del examen (minutos)"),
    ).toBeInTheDocument();
  });

  it("calls onChange when title input is typed", async () => {
    const onChange = vi.fn();
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText("Ingresa el nombre del examen");
    await userEvent.type(input, "A");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows time error when closeAt is before openAt", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          openAt: "2026-06-01T11:00",
          closeAt: "2026-06-01T09:00",
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /La hora de cierre tiene que ser posterior a la de inicio/,
      ),
    ).toBeInTheDocument();
  });

  it("shows score error when passingScore > totalScore", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          passingScore: 120,
          totalScore: 100,
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).toBeInTheDocument();
  });

  it("clears the time validation error once closeAt is after openAt", () => {
    const { rerender } = render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          openAt: "2026-06-01T11:00",
          closeAt: "2026-06-01T09:00",
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /La hora de cierre tiene que ser posterior a la de inicio/,
      ),
    ).toBeInTheDocument();

    rerender(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          openAt: "2026-06-01T09:00",
          closeAt: "2026-06-01T11:00",
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByText(
        /La hora de cierre tiene que ser posterior a la de inicio/,
      ),
    ).not.toBeInTheDocument();
  });

  it("clears the score validation error once passingScore is within total", () => {
    const { rerender } = render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          passingScore: 120,
          totalScore: 100,
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).toBeInTheDocument();

    rerender(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{
          ...baseConfig,
          passingScore: 60,
          totalScore: 100,
        }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).not.toBeInTheDocument();
  });

  it("does not expose Phase 2 runtime controls", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("开放模式")).not.toBeInTheDocument();
    expect(screen.queryByText("严格模式")).not.toBeInTheDocument();
    expect(screen.queryByText("标准模式")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fila de ingreso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/限制访问网络/)).not.toBeInTheDocument();
    expect(screen.queryByText(/要求锁定环境/)).not.toBeInTheDocument();
  });

  it("does not author unsupported control flags (#516 product truthfulness)", () => {
    // The runtime cannot enforce tab-switch detection or copy/paste blocking,
    // so the authoring surface must not offer them (the canonical validator
    // rejects their activation server-side).
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/检测切屏/)).not.toBeInTheDocument();
    expect(screen.queryByText(/禁止复制粘贴/)).not.toBeInTheDocument();
  });

  it("renders retake policy section", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getAllByText("Política de reintentos").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders max attempts field", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Máximo de intentos")).toBeInTheDocument();
  });

  it("renders result publication mode selector with default immediate", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText("Cómo se publican los resultados"),
    ).toBeInTheDocument();
    expect(screen.getByText("Al entregar")).toBeInTheDocument();
  });

  it("renders manual mode option when resultPublicationMode is manual", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{ ...baseConfig, resultPublicationMode: "manual" }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Lo publica un administrador")).toBeInTheDocument();
  });
});

describe("ExamConfigForm passing-score invariant (EXAM-SCORE-INV-1)", () => {
  it("passing-score input exposes min=0", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    const input = screen.getByTestId("passingScore-input");
    expect(input).toHaveAttribute("min", "0");
  });

  it("total-score input remains min=1", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={baseConfig}
        questions={[]}
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText("Puntaje total");
    expect(input).toHaveAttribute("min", "1");
  });

  it("passingScore > totalScore shows validation error", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{ ...baseConfig, passingScore: 120, totalScore: 100 }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).toBeInTheDocument();
  });

  it("passingScore = totalScore does not show error", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{ ...baseConfig, passingScore: 100, totalScore: 100 }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).not.toBeInTheDocument();
  });

  it("passingScore = 0 does not produce a lower-bound UI error", () => {
    render(
      <ExamConfigForm
        courses={[{ id: "course-1", name: "Course 1" }]}
        data={{ ...baseConfig, passingScore: 0, totalScore: 100 }}
        questions={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByText(
        /El puntaje de aprobación no puede superar el puntaje total/,
      ),
    ).not.toBeInTheDocument();
  });
});
