import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ExamCreatePage } from "./ExamCreatePage";
import { permissionsForRole } from "@exam/authz";
import type { ExamProfileDTO } from "@exam/contracts";

const mockCourses = [{ id: "c1", name: "数学", code: "MATH101" }];
const mockQuestions = [
  {
    id: "q1",
    type: "true_false",
    content: "2+2=4",
    score: 10,
    courseId: "c1",
    standardAnswer: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "q2",
    type: "single_choice",
    content: "Capital of France?",
    score: 15,
    courseId: "c1",
    standardAnswer: "Paris",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function defaultApiGet(path: string): unknown {
  if (path.includes("/api/subjects"))
    return { items: [{ id: "s1", name: "Álgebra" }] };
  if (path.includes("/api/courses"))
    return { items: mockCourses, total: 1, totalPages: 1 };
  if (path.includes("/api/questions"))
    return { items: mockQuestions, total: 2, totalPages: 1 };
  if (path.includes("/api/exam-profiles")) return [] as ExamProfileDTO[];
  return {};
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/exams/new"]}>
      <AuthProvider
        initialUser={{
          id: "1",
          username: "admin",
          name: "Admin",
          role: "Admin",
          organizationId: "org1",
          capabilities: [...permissionsForRole("Admin")],
        }}
      >
        <BrandProvider>
          <Routes>
            <Route path="/admin/exams/new" element={<ExamCreatePage />} />
            <Route
              path="/admin/exams/:id"
              element={<div data-testid="exam-detail" />}
            />
            <Route
              path="/admin/exams"
              element={<div data-testid="exam-list" />}
            />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((path: string) =>
    Promise.resolve(defaultApiGet(path)),
  );
  apiPost.mockResolvedValue({ id: "exam-1" });
});

function fillTitle(value: string) {
  fireEvent.change(
    screen.getByPlaceholderText("Ingresá el nombre del examen"),
    {
      target: { value },
    },
  );
}

describe("ExamCreatePage wizard — materia y comisión", () => {
  it("creates a subject from the plus button and selects it", async () => {
    apiPost.mockImplementation((path: string, body: { name?: string }) => {
      if (path === "/api/subjects") {
        return { id: "s-new", name: body.name };
      }
      return { id: "exam-1" };
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    expect(
      screen.queryByPlaceholderText("O creá una materia nueva"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nueva materia" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Nueva materia" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Comisión")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Guardar" }),
    ).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Nombre"), "Física");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/subjects", { name: "Física" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: "Materia" })).toHaveTextContent(
      "Física",
    );
    expect(apiPost).not.toHaveBeenCalledWith("/api/courses", expect.anything());
  });

  it("opens a commission only for a subject already chosen", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    expect(
      screen.getByRole("button", { name: "Nueva comisión" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Materia" }));
    await user.click(await screen.findByRole("option", { name: "Álgebra" }));
    await user.click(screen.getByRole("button", { name: "Nueva comisión" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Nueva comisión" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("");
    expect(
      within(dialog).getByRole("combobox", { name: "Materia de la comisión" }),
    ).toHaveTextContent("Álgebra");
    expect(apiPost).not.toHaveBeenCalled();
  });
});

describe("ExamCreatePage wizard — step 1 (basic + profile)", () => {
  it("renders the wizard title and step 1 fields", async () => {
    renderPage();
    expect(await screen.findByText("Crear examen")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ingresa el nombre del examen"),
    ).toBeInTheDocument();
    // Profile picker is present on step 1.
    expect(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    ).toBeInTheDocument();
  });

  it("does NOT surface latent Phase-2 control flags anywhere in the wizard", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    // Step 1, then step 2 (policy fields — where such flags would appear)…
    fillTitle("Flags Exam");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByLabelText("Duración del examen (minutos)");
    // …then the review step, covering every conditional surface.
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    }
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("Revisar antes de crear");
    expect(screen.queryByText(/随机选题/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fila de ingreso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/限制访问网络/)).not.toBeInTheDocument();
    expect(screen.queryByText(/要求锁定环境/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mezclar las preguntas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/禁止复制粘贴/)).not.toBeInTheDocument();
  });

  it("blocks Next when title is empty and shows a field error", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      await screen.findByText("Ingresa el nombre del examen"),
    ).toBeInTheDocument();
    // Still on step 1.
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("profile select defaults to Sin plantilla", async () => {
    renderPage();
    await screen.findByText("Crear examen");
    // Profile select defaults to __none__ (Sin plantilla) — no interaction needed.
    expect(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    ).toHaveTextContent("Sin plantilla");
  });
});

describe("ExamCreatePage wizard — step 3 (questions + scores)", () => {
  async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Test Exam");
    await user.click(screen.getByRole("combobox", { name: "Materia" }));
    await user.click(await screen.findByRole("option", { name: "Álgebra" }));
    await user.click(screen.getByRole("combobox", { name: "Comisión" }));
    await user.click(await screen.findByRole("option", { name: "数学" }));
    // Step 1 → 2 (policy) → 3 (questions). Identify step 3 by its unique
    // question-picker button rather than the heading (which also appears in
    // the stepper).
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByRole("button", { name: "Agregar del banco" });
  }

  it("opens the question picker dialog and adds a question", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("2+2=4")).toBeInTheDocument();
    const addButtons = within(dialog).getAllByRole("button", {
      name: "Agregar",
    });
    await user.click(addButtons[0]!);
    await waitFor(() => {
      expect(screen.getByText("Preguntas elegidas (1)")).toBeInTheDocument();
    });
  });

  it("removes a selected question", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getAllByRole("button", { name: "Agregar" })[0]!,
    );
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.getByText("Preguntas elegidas (1)")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Quitar del examen" }));
    const confirmDialog = await screen.findByRole("alertdialog");
    await user.click(
      within(confirmDialog).getByRole("button", { name: "Quitar" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Preguntas elegidas (0)")).toBeInTheDocument(),
    );
  });

  it("loads questions from every page when more than 100 exist", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/api/questions")) {
        if (path.includes("page=2"))
          return Promise.resolve({
            items: [
              {
                id: "q3",
                type: "single_choice",
                content: "Second page question",
                score: 5,
              },
            ],
            total: 3,
            totalPages: 2,
          });
        return Promise.resolve({
          items: mockQuestions,
          total: 3,
          totalPages: 2,
        });
      }
      return Promise.resolve(defaultApiGet(path));
    });
    const user = userEvent.setup();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    // Page 1 and page 2 items are both selectable in the picker.
    expect(within(dialog).getByText("2+2=4")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Second page question"),
    ).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/api/questions?page=2&pageSize=100");
  });

  it("auto-calculates totalScore from the selected questions (10 + 15 = 25)", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    // Add BOTH fixture questions (scores 10 and 15).
    const addButtons = within(dialog).getAllByRole("button", {
      name: "Agregar",
    });
    await user.click(addButtons[0]!);
    await user.click(addButtons[1]!);
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    const scoreInputs = screen.getAllByLabelText("Puntos", {
      selector: "input",
    });
    fireEvent.change(scoreInputs[0]!, { target: { value: "10" } });
    fireEvent.change(scoreInputs[1]!, { target: { value: "15" } });
    // Auto mode: the Puntaje total input shows the sum and the auto-calc hint appears.
    await waitFor(() => {
      expect(
        screen.getByLabelText("Puntaje total", { selector: "input" }),
      ).toHaveValue(25);
    });
    expect(
      screen.getByText("Cálculo automático: 25 puntos"),
    ).toBeInTheDocument();
  });

  it("auto-adjusts the untouched default Puntaje de aprobación when it exceeds the auto total (born-in-error fix)", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    // Default Puntaje de aprobación is 60; adding questions totaling 25 would leave
    // passingScore > totalScore, blocking Siguiente with an unexplained error.
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    const addButtons = within(dialog).getAllByRole("button", {
      name: "Agregar",
    });
    await user.click(addButtons[0]!);
    await user.click(addButtons[1]!);
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    const scoreInputs = screen.getAllByLabelText("Puntos", {
      selector: "input",
    });
    fireEvent.change(scoreInputs[0]!, { target: { value: "10" } });
    fireEvent.change(scoreInputs[1]!, { target: { value: "15" } });
    // Puntaje para aprobar follows the auto total down to 60% (25 * 0.6 = 15).
    await waitFor(() => {
      expect(
        screen.getByLabelText("Puntaje para aprobar", { selector: "input" }),
      ).toHaveValue(15);
    });
    // The step is no longer born in an error state: no validation message and
    // Siguiente proceeds to the schedule step.
    expect(
      screen.queryByText(
        "El puntaje de aprobación no puede superar el puntaje total",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByLabelText("Inicio");
  });

  it("never overwrites an explicitly edited Puntaje de aprobación", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: "Agregar del banco" }));
    const dialog = await screen.findByRole("dialog");
    // User sets Puntaje para aprobar = 8 BEFORE picking questions.
    fireEvent.change(
      screen.getByLabelText("Puntaje para aprobar", { selector: "input" }),
      {
        target: { value: "8" },
      },
    );
    const addButtons = within(dialog).getAllByRole("button", {
      name: "Agregar",
    });
    await user.click(addButtons[0]!);
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    // The explicit value (8) survives question selection (8 <= 25 is valid).
    await waitFor(() => {
      expect(
        screen.getByLabelText("Puntaje para aprobar", { selector: "input" }),
      ).toHaveValue(8);
    });
  });
});

describe("ExamCreatePage wizard — no-profile create flow", () => {
  it("creates a draft exam via the review step (no profileId sent)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("My Exam");
    // 1 → 2 → 3 → 4 (schedule), then fill the schedule, then 4 → 5.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("Revisar antes de crear");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/exams",
        expect.not.objectContaining({ profileId: expect.anything() }),
      );
    });
    expect(apiPost).toHaveBeenCalledWith(
      "/api/exams",
      expect.objectContaining({ title: "My Exam" }),
    );
  });
});

describe("ExamCreatePage wizard — profile path", () => {
  const profile: ExamProfileDTO = {
    id: "p1",
    organizationId: "00000000-0000-0000-0000-000000000001",
    name: "Examen en línea estándar",
    description: "",
    timingMode: "timed_window" as const,
    durationMinutes: 90,
    latestStartOffsetMinutes: 15,
    minSubmitAfterStartMinutes: 10,
    retakePolicy: "max_attempts",
    maxAttempts: 2,
    scoreStrategy: "highest",
    resultPublicationMode: "after_grading",
    interruptionTimePolicy: "bounded_grace",
    interruptionGracePerIncidentSeconds: 300,
    interruptionGracePerAttemptSeconds: 600,
    restrictSimultaneousAccess: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };

  it("selecting a profile shows its values in step 2 and 'Con cambios' after override", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/api/exam-profiles")) return [profile];
      return defaultApiGet(path);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Profiled Exam");
    // Select the profile.
    await user.click(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Examen en línea estándar" }),
    );
    // COPY-ON-APPLY hint now visible.
    expect(
      screen.getAllByText(/选择模板后，模板中的设置将复制到本次考试/).length,
    ).toBeGreaterThan(0);
    // Go to step 2.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    // Profile duration (90) shown; at least one field badge says 来自「Examen en línea estándar」.
    const durationInput = screen.getByLabelText(
      "Duración del examen (minutos)",
    );
    expect(durationInput).toHaveValue(90);
    expect(
      screen.getAllByText("来自「Examen en línea estándar」").length,
    ).toBeGreaterThan(0);
    // Override duration → badge switches to Con cambios for that field.
    fireEvent.change(durationInput, { target: { value: 45 } });
    expect(screen.getAllByText("Con cambios").length).toBeGreaterThan(0);
    // Volver a la plantilla button appears.
    expect(
      screen.getByRole("button", { name: "Volver a la plantilla" }),
    ).toBeInTheDocument();
  });

  it("override is preserved as explicit value in the final POST payload", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/api/exam-profiles")) return [profile];
      return defaultApiGet(path);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Profiled Exam 2");
    await user.click(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Examen en línea estándar" }),
    );
    // Step 1 → 2.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    // Override duration.
    fireEvent.change(screen.getByLabelText("Duración del examen (minutos)"), {
      target: { value: 120 },
    });
    // Override latestStartOffsetMinutes → explicit null (clear the field).
    fireEvent.change(
      screen.getByLabelText("Último ingreso (minutos desde el inicio)"),
      {
        target: { value: "" },
      },
    );
    // Walk to review and create.
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    }
    // Fill schedule.
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("Revisar antes de crear");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/exams",
        expect.objectContaining({
          profileId: "p1",
          durationMinutes: 120,
          latestStartOffsetMinutes: null,
        }),
      );
    });
    // The NON-overridden profile fields (retakePolicy etc.) are NOT sent —
    // the backend applies the profile. Verify retakePolicy absent from payload.
    expect(apiPost).toHaveBeenCalledWith(
      "/api/exams",
      expect.not.objectContaining({ retakePolicy: expect.anything() }),
    );
  });

  it("reset-to-profile removes the override from the POST payload", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/api/exam-profiles")) return [profile];
      return defaultApiGet(path);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Reset Exam");
    await user.click(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Examen en línea estándar" }),
    );
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    fireEvent.change(screen.getByLabelText("Duración del examen (minutos)"), {
      target: { value: 45 },
    });
    // Reset.
    await user.click(
      screen.getByRole("button", { name: "Volver a la plantilla" }),
    );
    // Field reverted to profile value; at least one badge is from template.
    expect(screen.getByLabelText("Duración del examen (minutos)")).toHaveValue(
      90,
    );
    expect(
      screen.getAllByText("来自「Examen en línea estándar」").length,
    ).toBeGreaterThan(0);
  });
});

describe("ExamCreatePage wizard — validation routing", () => {
  it("routes a server schedule error (openAt/closeAt) to step 4 with the inline error", async () => {
    const user = userEvent.setup();
    const serverMsg = "服务器校验：结束时间无效";
    apiPost.mockRejectedValueOnce(
      Object.assign(new Error(serverMsg), {
        details: {
          fields: [{ field: "closeAt", message: serverMsg, code: "X" }],
        },
      }),
    );
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Bad Schedule");
    // Walk to step 4 with a LOCALLY VALID schedule, so the local gate passes
    // and the POST is actually reached (this test proves server routing).
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    }
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    // On step 5 (review). Submit; the server rejects with a closeAt field error.
    await screen.findByText("Revisar antes de crear");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    // The UI routes back to step 4 and renders the SERVER's inline field error
    // (distinct copy — it can only have come from the mocked rejection). It
    // appears both inline (FieldError) and in the global save-error banner.
    const serverErrors = await screen.findAllByText(serverMsg);
    expect(serverErrors.length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Inicio")).toBeInTheDocument();
    // Step 5's review heading is gone (queryByRole — getByRole throws on absence).
    expect(
      screen.queryByRole("heading", { name: "Revisar antes de crear" }),
    ).not.toBeInTheDocument();
  });

  it("routes a machine-coded server field error through the Web catalog, not server wording (C2 T2/T8)", async () => {
    const user = userEvent.setup();
    // Wire reality: top-level error.message is the registry compat text;
    // fields[].message is producer-local compat. Both differ from the
    // Web-catalog semantic the field renders.
    apiPost.mockRejectedValueOnce(
      Object.assign(
        new Error("Hay datos incorrectos. Revísalos e inténtalo de nuevo."),
        {
          code: "VALIDATION_ERROR",
          details: {
            fields: [
              {
                field: "courseId",
                code: "RESOURCE_NOT_FOUND",
                params: { resource: "course" },
                message: "SERVER COMPAT WORDING",
              },
            ],
          },
        },
      ),
    );
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Machine Course Error");
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    }
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("Revisar antes de crear");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    // The meaning comes from code+params via the Web catalog ("课程不存在");
    // the mutated server wording must never surface.
    expect(
      await screen.findByText("课程不存在", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("SERVER COMPAT WORDING")).not.toBeInTheDocument();
    // stepForField routes courseId back to step 1.
    expect(
      await screen.findByLabelText("Nombre del examen"),
    ).toBeInTheDocument();
  });

  it("stepper future steps are disabled — forward validation cannot be bypassed", async () => {
    renderPage();
    await screen.findByText("Crear examen");
    // On step 1, steps 2–5 are locked; only Siguiente advances.
    // (Stepper buttons expose an explicit aria-label with a number + label.)
    expect(
      screen.getByRole("button", { name: /5 Revisar y crear/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /2 Política del examen/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /1 Datos básicos/ }),
    ).toBeEnabled();
  });

  it("fixed validation errors do not linger as ghosts after re-validation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    // Trigger the title-required error.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      await screen.findByText("Ingresa el nombre del examen"),
    ).toBeInTheDocument();
    // Fix the title and advance — the error must be gone (we land on step 2).
    fillTitle("Fixed Title");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByLabelText("Duración del examen (minutos)");
    expect(
      screen.queryByText("Ingresa el nombre del examen"),
    ).not.toBeInTheDocument();
  });
});

describe("ExamCreatePage wizard — interruption policy override semantics", () => {
  it("switching a bounded_grace profile to strict atomically nulls both grace caps in the POST", async () => {
    const profile: ExamProfileDTO = {
      id: "p-grace",
      organizationId: "00000000-0000-0000-0000-000000000001",
      name: "宽限模板",
      description: "",
      timingMode: "timed_window" as const,
      durationMinutes: 90,
      latestStartOffsetMinutes: null,
      minSubmitAfterStartMinutes: null,
      retakePolicy: "unlimited",
      maxAttempts: 1,
      scoreStrategy: "highest",
      resultPublicationMode: "immediate",
      interruptionTimePolicy: "bounded_grace",
      interruptionGracePerIncidentSeconds: 300,
      interruptionGracePerAttemptSeconds: 600,
      restrictSimultaneousAccess: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    };
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/api/exam-profiles")) return [profile];
      return defaultApiGet(path);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Crear examen");
    fillTitle("Strict Exam");
    await user.click(
      screen.getByRole("combobox", { name: "Usar plantilla existente" }),
    );
    await user.click(await screen.findByRole("option", { name: "宽限模板" }));
    // Step 1 → 2.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    // Switch policy from bounded_grace to strict (Sin tiempo extra).
    await user.click(
      screen.getByRole("combobox", { name: "Política si se interrumpe" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Sin tiempo extra" }),
    );
    // Walk to review and create.
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    }
    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-09-01T11:00" },
    });
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("Revisar antes de crear");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/exams",
        expect.objectContaining({
          profileId: "p-grace",
          interruptionTimePolicy: "strict",
          interruptionGracePerIncidentSeconds: null,
          interruptionGracePerAttemptSeconds: null,
        }),
      );
    });
  });
});
