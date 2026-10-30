import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ExamPreviewPage } from "./ExamPreviewPage";
import { permissionsForRole } from "@exam/authz";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  setNavigate: () => {},
}));

const previewFixture = {
  examId: "exam-1",
  title: "Examen de prueba",
  description: "",
  timingMode: "timed_window" as const,
  durationMinutes: 60,
  questions: [
    {
      id: "q1",
      type: "true_false" as const,
      prompt: "¿Afirmación uno?",
      promptDocument: null,
      answerMode: "plain" as const,
      options: [],
      inputMode: "boolean" as const,
      maxScore: 10,
      answerValue: null,
      answerSource: "none" as const,
    },
    {
      id: "q2",
      type: "single_choice" as const,
      prompt: "¿Opción correcta?",
      promptDocument: null,
      answerMode: "plain" as const,
      options: [
        { id: "o1", content: "A", contentDocument: null },
        { id: "o2", content: "B", contentDocument: null },
      ],
      inputMode: "choice" as const,
      maxScore: 10,
      answerValue: null,
      answerSource: "none" as const,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/preview/exams/exam-1"]}>
      <AuthProvider
        initialUser={{
          id: "1",
          username: "teacher",
          name: "Teacher",
          role: "Teacher",
          organizationId: "org1",
          capabilities: [...permissionsForRole("Teacher")],
        }}
      >
        <BrandProvider>
          <Routes>
            <Route path="/preview/exams/:id" element={<ExamPreviewPage />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ExamPreviewPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockResolvedValue(previewFixture);
  });

  it("shows the preview banner and loads questions", async () => {
    renderPage();
    expect(
      await screen.findByText(
        "Vista previa. Así ve el examen un alumno. Las respuestas no se guardan.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("¿Afirmación uno?")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/api/exams/exam-1/preview");
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("navigates between questions and marks answers locally", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("¿Afirmación uno?");

    await user.click(screen.getByTestId("true-false-true"));
    await user.click(
      screen.getByRole("button", { name: "Pregunta siguiente" }),
    );

    await waitFor(() =>
      expect(screen.getByText("¿Opción correcta?")).toBeInTheDocument(),
    );
    expect(apiPost).not.toHaveBeenCalled();
  });
});
