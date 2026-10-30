import { useState, type ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamQuestionsEditor, moveItem } from "./ExamQuestionsEditor";
import { emptyQuestionFormData } from "@/components/question/questionPayload";
import type { QuestionFormData } from "@/components/question/QuestionForm";

const mockFormData: QuestionFormData = {
  ...emptyQuestionFormData(),
  content: "Enunciado de prueba",
};

vi.mock("@/components/question/QuestionForm", () => ({
  QuestionForm: ({
    onChange,
  }: {
    onChange: (data: QuestionFormData) => void;
  }) => (
    <button type="button" onClick={() => onChange(mockFormData)}>
      Sincronizar formulario
    </button>
  ),
}));

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
  setNavigate: () => {},
}));

const bank = [
  { id: "q1", type: "true_false", content: "2+2=4" },
  { id: "q2", type: "single_choice", content: "Capital?" },
];

function cardForContent(content: string): HTMLElement {
  const el = screen.getByText(content).closest("li");
  if (!el) throw new Error(`no card for: ${content}`);
  return el as HTMLElement;
}

function renderEditor(
  props: Partial<ComponentProps<typeof ExamQuestionsEditor>> = {},
) {
  const onChange = vi.fn();
  const onBankChange = vi.fn();
  render(
    <ExamQuestionsEditor
      questionIds={[]}
      questionScores={{}}
      bank={bank}
      onChange={onChange}
      onBankChange={onBankChange}
      {...props}
    />,
  );
  return { onChange, onBankChange };
}

describe("moveItem", () => {
  it("moves an element within the list", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("returns the same list for invalid indices", () => {
    const list = ["a", "b"];
    expect(moveItem(list, -1, 1)).toBe(list);
    expect(moveItem(list, 0, 0)).toBe(list);
  });
});

describe("ExamQuestionsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      id: "q1",
      type: "true_false",
      content: "2+2=4",
      options: [],
      standardAnswer: true,
      difficulty: 3,
      tags: [],
      gradingRule: emptyQuestionFormData().gradingRule,
    });
    apiPost.mockImplementation((_path: string, _body: unknown) =>
      Promise.resolve({
        id: "q-new",
        type: "single_choice",
        content: "Enunciado de prueba",
      }),
    );
    apiPatch.mockImplementation((_path: string, _body: unknown) =>
      Promise.resolve({
        id: "q1",
        type: "true_false",
        content: "Actualizado",
      }),
    );
  });

  it("adds a question from the bank", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getAllByRole("button", { name: "Agregar" })[0]!,
    );
    expect(onChange).toHaveBeenCalledWith({
      questionIds: ["q1"],
      questionScores: { q1: 1 },
    });
  });

  it("creates a new question on save", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Nueva pregunta" }));
    await user.click(
      screen.getByRole("button", { name: "Sincronizar formulario" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/questions",
        expect.objectContaining({ content: "Enunciado de prueba" }),
      );
    });
    expect(onChange).toHaveBeenCalledWith({
      questionIds: ["q-new"],
      questionScores: { "q-new": 1 },
    });
  });

  it("PATCHes an existing question when choosing replace in bank", async () => {
    const user = userEvent.setup();
    renderEditor({
      questionIds: ["q1"],
      questionScores: { q1: 2 },
    });
    await user.click(
      within(cardForContent("2+2=4")).getByRole("button", {
        name: "Editar pregunta",
      }),
    );
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/questions/q1"),
    );
    await user.click(
      screen.getByRole("button", { name: "Sincronizar formulario" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Reemplazar en el banco" }),
    );
    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith(
        "/api/questions/q1",
        expect.objectContaining({ content: "Enunciado de prueba" }),
      );
    });
  });

  it("POSTs a copy and swaps ids when choosing save as copy", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({
      id: "q-copy",
      type: "single_choice",
      content: "Enunciado de prueba",
    });
    const { onChange } = renderEditor({
      questionIds: ["q1", "q2"],
      questionScores: { q1: 4, q2: 1 },
    });
    await user.click(
      within(cardForContent("2+2=4")).getByRole("button", {
        name: "Editar pregunta",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Sincronizar formulario" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar como copia" }),
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        questionIds: ["q-copy", "q2"],
        questionScores: { "q-copy": 4, q2: 1 },
      });
    });
  });

  it("PATCHes session-created questions without a dialog", async () => {
    const user = userEvent.setup();
    apiPost.mockImplementation(() =>
      Promise.resolve({
        id: "q-session",
        type: "single_choice",
        content: "Enunciado de prueba",
      }),
    );
    function StatefulEditor() {
      const [questionIds, setQuestionIds] = useState<string[]>([]);
      const [questionScores, setQuestionScores] = useState<
        Record<string, number>
      >({});
      const [localBank, setLocalBank] = useState(bank);
      return (
        <ExamQuestionsEditor
          questionIds={questionIds}
          questionScores={questionScores}
          bank={localBank}
          onChange={({ questionIds, questionScores }) => {
            setQuestionIds(questionIds);
            setQuestionScores(questionScores);
          }}
          onBankChange={setLocalBank}
        />
      );
    }
    render(<StatefulEditor />);
    await user.click(screen.getByRole("button", { name: "Nueva pregunta" }));
    await user.click(
      screen.getByRole("button", { name: "Sincronizar formulario" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    await screen.findByText("Preguntas elegidas (1)");
    await user.click(
      within(cardForContent("Enunciado de prueba")).getByRole("button", {
        name: "Editar pregunta",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Sincronizar formulario" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith(
        "/api/questions/q-session",
        expect.any(Object),
      );
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("reorders with move up and disables at edges", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({
      questionIds: ["q1", "q2"],
      questionScores: { q1: 1, q2: 1 },
    });
    const firstCard = cardForContent("2+2=4");
    expect(
      within(firstCard).getByRole("button", { name: "Subir pregunta" }),
    ).toBeDisabled();
    await user.click(
      within(firstCard).getByRole("button", { name: "Bajar pregunta" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      questionIds: ["q2", "q1"],
      questionScores: { q1: 1, q2: 1 },
    });
  });

  it("does not DELETE when removing from the exam", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({
      questionIds: ["q1"],
      questionScores: { q1: 1 },
    });
    await user.click(screen.getByRole("button", { name: "Quitar del examen" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));
    expect(onChange).toHaveBeenCalledWith({
      questionIds: [],
      questionScores: { q1: 1 },
    });
    expect(apiDelete).not.toHaveBeenCalled();
  });
});
