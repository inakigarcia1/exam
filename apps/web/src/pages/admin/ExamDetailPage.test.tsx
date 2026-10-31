import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ExamDetailPage } from "./ExamDetailPage";
import { permissionsForRole } from "@exam/authz";

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
    post: vi.fn(),
    delete: vi.fn(),
  },
  setNavigate: () => {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const deleteMock = vi.mocked(api.delete);

const mockDraftExam = {
  id: "exam-1",
  title: "期末能力测评",
  description: "",
  courseId: "course-1",
  status: "draft",
  timingMode: "timed_window",
  durationMinutes: 60,
  openAt: new Date().toISOString(),
  closeAt: new Date(Date.now() + 86400000).toISOString(),
  passingScore: 60,
  totalScore: 100,
  questionIds: ["q1", "q2"],
  controlFlags: {},
  retakePolicy: "no-retake",
  scoreStrategy: "best",
  maxAttempts: 1,
  stats: {
    participantCount: 0,
    activeAttemptCount: 0,
    completedCount: 0,
    passedCount: 0,
  },
  participants: [],
};

function renderPage(role: "Admin" | "Teacher" = "Admin") {
  return render(
    <MemoryRouter initialEntries={["/admin/exams/exam-1"]}>
      <AuthProvider
        initialUser={{
          id: "admin-1",
          username: "admin",
          name: "Admin",
          role,
          organizationId: "org1",
          capabilities: [...permissionsForRole(role)],
        }}
      >
        <BrandProvider>
          <Routes>
            <Route path="/admin/exams/:id" element={<ExamDetailPage />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ExamDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    getMock.mockImplementation((path: string) => {
      if (path.includes("/enrollments")) return Promise.resolve([]);
      return Promise.resolve({ ...mockDraftExam });
    });
  });

  describe("layout structure", () => {
    it("renders stats cards at the top", async () => {
      renderPage();
      expect(await screen.findByText("期末能力测评")).toBeInTheDocument();
      expect(screen.getByText("Estado")).toBeInTheDocument();
      expect(screen.getByText("Duración del examen")).toBeInTheDocument();
      expect(screen.getByText("Puntaje de aprobación")).toBeInTheDocument();
      expect(screen.getByText("Cantidad de preguntas")).toBeInTheDocument();
    });

    it("renders config section", async () => {
      renderPage();
      expect(
        await screen.findByText("Configuración del examen"),
      ).toBeInTheDocument();
      // Policy enums render as localized labels, never raw values.
      expect(screen.getByText("Ventana con límite")).toBeInTheDocument();
      expect(screen.queryByText("timed_window")).not.toBeInTheDocument();
    });

    // Characterization: the detail stat strip is the StatsCard authority and
    // the config block is a PageSection — each title must sit inside its
    // governed region holding the associated value.
    it("keeps stat and config titles inside their governed regions", async () => {
      renderPage();
      const statusLabel = await screen.findByText("Estado");
      const statCard = statusLabel.closest("[data-slot='stats-card']");
      expect(statCard).toBeInTheDocument();
      const configLabel = await screen.findByText("Configuración del examen");
      const configSection = configLabel.closest("section");
      expect(configSection).toBeInTheDocument();
      expect(configSection).toHaveTextContent("Ventana con límite");
    });

    it("renders Phase 1 tabs without audit placeholder", async () => {
      renderPage();
      expect(
        await screen.findByRole("tab", { name: "Inscripción" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "Calificaciones" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "操作日志" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("enrollment tab", () => {
    it("shows enrollment stats and table inInscripción tab", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments"))
          return Promise.resolve([
            {
              id: "enr-1",
              examId: "exam-1",
              candidateId: "c1",
              candidateDisplayName: "张三",
              candidateIdentity: "EMP001",
              status: "assigned",
              attemptCount: 0,
              finalScore: null,
              finalPassed: null,
            },
          ]);
        return Promise.resolve({
          ...mockDraftExam,
          stats: {
            participantCount: 1,
            activeAttemptCount: 0,
            completedCount: 0,
            passedCount: 0,
          },
        });
      });
      renderPage();
      const table = await screen.findByRole("table");
      expect(within(table).getByText("张三")).toBeInTheDocument();
      expect(within(table).getByText("EMP001")).toBeInTheDocument();
    });

    it("shows empty state when no enrollments", async () => {
      renderPage();
      expect(await screen.findByText("No hay alumnos")).toBeInTheDocument();
    });
  });

  describe("scores tab", () => {
    it("shows scores tab content with link to score list", async () => {
      renderPage();
      await screen.findByRole("tab", { name: "Calificaciones" });
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: "Calificaciones" }));
      expect(screen.getByText("Gestión de calificaciones")).toBeInTheDocument();
    });
  });

  describe("publish and archive", () => {
    it("shows Teacher authoring actions but hides Admin-only lifecycle actions", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "open",
          resultPublicationMode: "manual",
          resultsPublishedAt: null,
        });
      });

      renderPage("Teacher");

      expect(
        await screen.findByTestId("exam-detail-close-btn"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("exam-detail-publish-results-btn"),
      ).toBeInTheDocument();
      expect(screen.getByText("Agregar alumno")).toBeInTheDocument();
      expect(
        screen.queryByTestId("exam-detail-extend-btn"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Supervisión")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancelar examen")).not.toBeInTheDocument();
    });

    it("hides published-state Admin-only lifecycle actions from Teacher", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "published",
          resultPublicationMode: "manual",
          resultsPublishedAt: null,
        });
      });

      renderPage("Teacher");

      await screen.findByText("期末能力测评");
      expect(
        screen.queryByTestId("exam-detail-unpublish-btn"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Archivar")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancelar examen")).not.toBeInTheDocument();
      expect(
        screen.getByTestId("exam-detail-publish-results-btn"),
      ).toBeInTheDocument();
    });

    it("publishes exam successfully", async () => {
      postMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByText("Publicar examen"));
      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/exams/exam-1/publish");
      });
    });

    it("shows publish error message on failure", async () => {
      postMock.mockRejectedValue(
        new ApiError(
          409,
          "El examen ya está publicado",
          "EXAM_ALREADY_PUBLISHED",
        ),
      );
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByText("Publicar examen"));
      expect(
        await screen.findByText("El examen ya está publicado"),
      ).toBeInTheDocument();
    });

    it("opens confirmation before archiving a published exam", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...mockDraftExam, status: "published" });
      });
      postMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      await user.click(screen.getByText("Archivar"));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(/期末能力测评/)).toBeInTheDocument();
      const confirm = within(dialog).getByRole("button", { name: "Confirmar" });
      expect(confirm).toHaveAttribute("data-variant", "destructive");
      await user.click(confirm);
      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/exams/exam-1/archive");
      });
    });

    it("does not show cancel button for draft exams", async () => {
      // draft → no cancel button
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...mockDraftExam, status: "draft" });
      });
      renderPage();
      await screen.findByText("期末能力测评");
      expect(screen.queryByText("Cancelar examen")).not.toBeInTheDocument();
    });

    it("opens confirmation and cancels a published exam", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...mockDraftExam, status: "published" });
      });
      postMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      await user.click(screen.getByText("Cancelar examen"));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(/期末能力测评/)).toBeInTheDocument();
      const confirm = within(dialog).getByRole("button", { name: "Confirmar" });
      expect(confirm).toHaveAttribute("data-variant", "destructive");
      await user.click(confirm);
      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/exams/exam-1/cancel");
      });
    });

    // Stale-extend recovery contract (#792; supersedes the AUGMENT-B as-built
    // characterization, which pinned "generic toast + dialog open + no
    // refetch" for every failure). A 409 EXAM_EXTEND_NOT_ALLOWED with
    // details.reason = ALREADY_CLOSED means another admin closed the exam
    // while this page held a stale open state: the recovery branch exits the
    // dialog, refetches once, and lets the fresh server status drive the
    // projection — the "updated" claim is made only after the refetch
    // succeeded. Every OTHER failure keeps the legacy handling (generic
    // toast, dialog open, no refetch).
    const staleClosedError = () =>
      new ApiError(
        409,
        "En este estado no se puede extender el examen",
        "EXAM_EXTEND_NOT_ALLOWED",
        {
          reason: "ALREADY_CLOSED",
        },
      );

    it("stale-close 409 exits the dialog, refetches once, and projects the refreshed closed state", async () => {
      // Superset shape up front so the pre/post-refresh payloads share one
      // inferred type (mockDraftExam alone lacks the results fields).
      let currentExam = {
        ...mockDraftExam,
        status: "open",
        resultPublicationMode: "manual",
        resultsPublishedAt: null,
      };
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...currentExam });
      });
      postMock.mockRejectedValueOnce(staleClosedError());
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      expect(screen.getByTestId("exam-detail-extend-btn")).toBeInTheDocument();

      await user.click(screen.getByTestId("exam-detail-extend-btn"));
      const dialog = screen.getByRole("dialog");
      // The server truth flips before the rejection's refetch lands: the
      // initial page rendered open, the refresh must observe closed.
      currentExam = { ...currentExam, status: "closed" };
      await user.click(
        within(dialog).getByRole("button", { name: "延长 15 分钟" }),
      );

      // Exactly one rejected extend mutation, then exactly one refresh.
      await waitFor(() => {
        expect(postMock).toHaveBeenCalledTimes(1);
      });
      expect(postMock).toHaveBeenCalledWith("/api/exams/exam-1/extend", {
        extendMinutes: 15,
      });
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "El examen ya está cerrado, así que no se puede extender. El estado ya está actualizado.",
        );
      });
      // The rejected operation never claims success.
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // Server-driven projection: the stale open-state entries are gone and
      // the closed status badge is shown.
      expect(
        screen.queryByTestId("exam-detail-extend-btn"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("exam-detail-close-btn"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Cancelar examen")).not.toBeInTheDocument();
      expect(screen.getByText("Cerrado")).toBeInTheDocument();
      // The refreshed closed projection is not merely a subtraction: the
      // still-legal closed-state entries (archive for the capable Admin,
      // manual-mode publish-results) appear, exactly as a native closed
      // render would.
      expect(screen.getByText("Archivar")).toBeInTheDocument();
      expect(
        screen.getByTestId("exam-detail-publish-results-btn"),
      ).toBeInTheDocument();
    });

    it("stale-close 409 with a failing refetch reports the real failure and keeps the retry path", async () => {
      let refreshMustFail = false;
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        if (refreshMustFail) return Promise.reject(new Error("network down"));
        return Promise.resolve({ ...mockDraftExam, status: "open" });
      });
      postMock.mockRejectedValueOnce(staleClosedError());
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      const readsAfterLoad = getMock.mock.calls.length;

      await user.click(screen.getByTestId("exam-detail-extend-btn"));
      const dialog = screen.getByRole("dialog");
      refreshMustFail = true;
      await user.click(
        within(dialog).getByRole("button", { name: "延长 15 分钟" }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "El examen ya está cerrado, así que no se puede extender. No se pudo cargar el estado nuevo. Intentá de nuevo.",
        );
      });
      // No false recovery claim for a failed refresh.
      expect(toast.success).not.toHaveBeenCalled();
      // One rejected mutation, exactly one refresh attempt, no loop.
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(getMock.mock.calls.length).toBe(readsAfterLoad + 1);
      // The failed refresh surfaces the standard retryable error state —
      // never a blank page or a stale actionable dialog.
      expect(
        await screen.findByText("No se pudo cargar el examen"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("warns in the close dialog that active attempts are submitted", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "open",
          stats: { ...mockDraftExam.stats, activeAttemptCount: 2 },
        });
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");

      await user.click(screen.getByTestId("exam-detail-close-btn"));

      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Hay 2 alumno(s) rindiendo: se entregan automáticamente con lo que tengan guardado.",
      );
    });

    it("does not warn in the close dialog when nobody is answering", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...mockDraftExam, status: "open" });
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");

      await user.click(screen.getByTestId("exam-detail-close-btn"));

      expect(screen.getByRole("alertdialog")).not.toHaveTextContent(
        "rindiendo",
      );
    });

    it("non-stale extend failures keep the legacy handling: generic toast, dialog open, no refetch", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...mockDraftExam, status: "open" });
      });
      postMock.mockRejectedValueOnce(
        new ApiError(500, "Error interno del servidor", "INTERNAL_ERROR"),
      );
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      const readsAfterLoad = getMock.mock.calls.length;

      await user.click(screen.getByTestId("exam-detail-extend-btn"));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "延长 15 分钟" }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "No se pudo extender. Intentá de nuevo más tarde.",
        );
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(getMock.mock.calls.length).toBe(readsAfterLoad);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("exam-detail-extend-btn")).toBeInTheDocument();
    });

    // Closed-state action projection (post-#784 hardening, #791): the closed
    // branch previously had NO permanent component owner — the one-shot CDP
    // witness (C-J2 J2-D) was consumed and never counted as regression
    // protection. Per the lifecycle (draft → published → open → closed →
    // archived) a closed exam keeps Archive and — for manual-mode exams with
    // unpublished results — Publish Results, and loses every draft/open/
    // published-only entry. Deliberately NOT "only an archive button".
    const closedExam = {
      ...mockDraftExam,
      status: "closed",
      resultPublicationMode: "manual",
      resultsPublishedAt: null,
    };

    it("renders the closed status with archive, publish-results and back-to-list entries", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...closedExam });
      });

      renderPage("Admin");

      expect(await screen.findByText("期末能力测评")).toBeInTheDocument();
      expect(screen.getByText("Cerrado")).toBeInTheDocument();
      expect(screen.getByText("Archivar")).toBeInTheDocument();
      expect(
        screen.getByTestId("exam-detail-publish-results-btn"),
      ).toBeInTheDocument();
      expect(screen.getByText("Volver a la lista")).toBeEnabled();
    });

    it("hides every draft/open/published-only lifecycle entry in the closed state", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({ ...closedExam });
      });

      renderPage("Admin");

      await screen.findByText("期末能力测评");
      expect(
        screen.queryByTestId("exam-detail-close-btn"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("exam-detail-extend-btn"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("exam-detail-unpublish-btn"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Cancelar examen")).not.toBeInTheDocument();
      expect(screen.queryByText("Publicar examen")).not.toBeInTheDocument();
      expect(screen.queryByText("Editar")).not.toBeInTheDocument();
      expect(screen.queryByText("Supervisión")).not.toBeInTheDocument();
    });

    it("shows publish-results button for manual-mode unpublished published exam", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "published",
          resultPublicationMode: "manual",
          resultsPublishedAt: null,
        });
      });
      renderPage();
      expect(
        await screen.findByTestId("exam-detail-publish-results-btn"),
      ).toBeInTheDocument();
    });

    it("hides publish-results button when results already published", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "published",
          resultPublicationMode: "manual",
          resultsPublishedAt: new Date().toISOString(),
        });
      });
      renderPage();
      await screen.findByText("期末能力测评");
      expect(
        screen.queryByTestId("exam-detail-publish-results-btn"),
      ).toBeNull();
    });

    it("hides publish-results button for immediate-mode exam", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "published",
          resultPublicationMode: "immediate",
          resultsPublishedAt: null,
        });
      });
      renderPage();
      await screen.findByText("期末能力测评");
      expect(
        screen.queryByTestId("exam-detail-publish-results-btn"),
      ).toBeNull();
    });

    it("publishes results after confirmation", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          status: "published",
          resultPublicationMode: "manual",
          resultsPublishedAt: null,
        });
      });
      postMock.mockResolvedValue({
        ok: true,
        resultsPublishedAt: new Date().toISOString(),
        alreadyPublished: false,
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByTestId("exam-detail-publish-results-btn");
      await user.click(screen.getByTestId("exam-detail-publish-results-btn"));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Confirmar" }),
      );
      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith(
          "/api/exams/exam-1/publish-results",
        );
      });
    });
  });

  describe("enrollment management", () => {
    it("opens add enrollment dialog", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        if (path.includes("/api/candidates"))
          return Promise.resolve({ items: [], total: 0 });
        return Promise.resolve(mockDraftExam);
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("期末能力测评");
      const addButtons = screen.getAllByText("Agregar alumno");
      await user.click(addButtons[0]!);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows enrollment status using StatusBadge", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments"))
          return Promise.resolve([
            {
              id: "enr-1",
              examId: "exam-1",
              candidateId: "c1",
              candidateDisplayName: "张三",
              candidateIdentity: "EMP001",
              status: "assigned",
              attemptCount: 0,
              finalScore: null,
              finalPassed: null,
            },
          ]);
        return Promise.resolve(mockDraftExam);
      });
      renderPage();
      const table = await screen.findByRole("table");
      expect(within(table).getByText("张三")).toBeInTheDocument();
      expect(within(table).getByText("Asignado")).toBeInTheDocument();
    });

    it("shows remove button only for assigned enrollments", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments"))
          return Promise.resolve([
            {
              id: "enr-1",
              examId: "exam-1",
              candidateId: "c1",
              candidateDisplayName: "张三",
              status: "assigned",
              attemptCount: 0,
              finalScore: null,
              finalPassed: null,
            },
            {
              id: "enr-2",
              examId: "exam-1",
              candidateId: "c2",
              candidateDisplayName: "李四",
              status: "completed",
              attemptCount: 1,
              finalScore: 80,
              finalPassed: true,
            },
          ]);
        return Promise.resolve(mockDraftExam);
      });
      renderPage();
      const table = await screen.findByRole("table");
      expect(within(table).getByText("张三")).toBeInTheDocument();
      const removeButtons = within(table).getAllByRole("button", {
        name: "Quitar alumno",
      });
      expect(removeButtons).toHaveLength(1);
    });
  });

  describe("error states", () => {
    it("shows error state when exam loading fails", async () => {
      getMock.mockRejectedValue(new Error("fail"));
      renderPage();
      expect(
        await screen.findByText("No se pudo cargar el examen"),
      ).toBeInTheDocument();
    });
  });

  // Phase A2 nullable timing (issue #389): deadline/untimed responses carry
  // durationMinutes = null (and closeAt = null for untimed). Projections must
  // key on the canonical timingMode and never render a fabricated duration or
  // an epoch timestamp, matching the candidate-side narrowing in StartExamPage.
  describe("nullable timing modes", () => {
    it("renders the explicit duration for timed_window", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          timingMode: "timed_window",
          durationMinutes: 45,
        });
      });
      renderPage();
      expect(await screen.findByText("45分钟")).toBeInTheDocument();
      expect(screen.getByText("Ventana con límite")).toBeInTheDocument();
    });

    it("renders deadline mode without fabricating a duration", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          timingMode: "deadline",
          durationMinutes: null,
          closeAt: new Date(Date.now() + 86400000).toISOString(),
        });
      });
      renderPage();
      expect(await screen.findByText("Con hora límite")).toBeInTheDocument();
      // i18next collapses a null interpolation to a bare “分钟” unit — the
      // fabricated-duration render this regression locks out.
      expect(screen.queryByText("分钟")).not.toBeInTheDocument();
      expect(screen.queryByText("0分钟")).not.toBeInTheDocument();
      // The config row localizes the mode instead of leaking the raw enum.
      expect(screen.getByText("Hora límite")).toBeInTheDocument();
      expect(screen.queryByText("deadline")).not.toBeInTheDocument();
    });

    it("renders untimed mode without fabricating duration or closeAt", async () => {
      getMock.mockImplementation((path: string) => {
        if (path.includes("/enrollments")) return Promise.resolve([]);
        return Promise.resolve({
          ...mockDraftExam,
          timingMode: "untimed",
          durationMinutes: null,
          closeAt: null,
        });
      });
      renderPage();
      // Duration card AND the config timingMode row both render Sin límite de tiempo.
      expect(
        (await screen.findAllByText("Sin límite de tiempo")).length,
      ).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText("分钟")).not.toBeInTheDocument();
      // formatDateTime(null) renders the 1970 epoch — never reachable.
      expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
      expect(screen.queryByText("untimed")).not.toBeInTheDocument();
    });
  });
});
