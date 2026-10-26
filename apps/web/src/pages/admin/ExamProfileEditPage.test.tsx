import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ExamProfileEditPage } from "./ExamProfileEditPage";
import type { ExamProfileDTO } from "@exam/contracts";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
    setNavigate: () => {},
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage(path = "/admin/exam-profiles/new") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin/exam-profiles/new"
            element={<ExamProfileEditPage />}
          />
          <Route
            path="/admin/exam-profiles/:id/edit"
            element={<ExamProfileEditPage />}
          />
          <Route
            path="/admin/exam-profiles"
            element={<div>profile list</div>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const existing: ExamProfileDTO = {
  id: "p-1",
  organizationId: "00000000-0000-0000-0000-000000000001",
  name: "Examen en línea estándar",
  description: "existing",
  timingMode: "timed_window" as const,
  durationMinutes: 90,
  latestStartOffsetMinutes: 20,
  minSubmitAfterStartMinutes: 5,
  retakePolicy: "max_attempts",
  maxAttempts: 3,
  scoreStrategy: "highest",
  resultPublicationMode: "after_grading",
  interruptionTimePolicy: "bounded_grace",
  interruptionGracePerIncidentSeconds: 200,
  interruptionGracePerAttemptSeconds: 400,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExamProfileEditPage — create path", () => {
  it("renders the create title and an empty form", async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByRole("heading", { name: "Nueva plantilla de política" }),
    ).toBeInTheDocument();
    // Default duration is 60.
    expect(screen.getByLabelText("Duración del examen (minutos)")).toHaveValue(60);
  });

  it("requires a name and shows a field error", async () => {
    await act(async () => {
      renderPage();
    });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Ingresa el nombre de la plantilla")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("creates a profile with explicit fields on save", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ ...existing, id: "new" });
    await act(async () => {
      renderPage();
    });
    await userEvent.type(screen.getByLabelText("Nombre de la plantilla"), "我的模板");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(api.post).toHaveBeenCalledWith(
      "/api/exam-profiles",
      expect.objectContaining({
        name: "我的模板",
        durationMinutes: 60,
        retakePolicy: "unlimited",
        resultPublicationMode: "immediate",
        interruptionTimePolicy: "strict",
        interruptionGracePerIncidentSeconds: null,
        interruptionGracePerAttemptSeconds: null,
      }),
    );
  });

  it("prefills from a starter recipe via the starter dialog", async () => {
    await act(async () => {
      renderPage();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Crear desde una plantilla base" }),
    );
    const dialog = await screen.findByRole("dialog");
    // Two starter recipes present.
    expect(within(dialog).getByText("Prueba básica")).toBeInTheDocument();
    expect(within(dialog).getByText("Examen en línea estándar")).toBeInTheDocument();
    // Pick the standard-online card via its stable data-starter-recipe hook
    // (not button index), then use its Usar esta plantilla button.
    const standardCard = within(dialog)
      .getByText("Examen en línea estándar")
      .closest("[data-starter-recipe]");
    expect(standardCard).not.toBeNull();
    await userEvent.click(
      within(standardCard as HTMLElement).getByRole("button", {
        name: "Usar esta plantilla",
      }),
    );
    // After prefill, the bounded_grace caps inputs are visible.
    expect(screen.getByLabelText("Tope de tiempo extra por interrupción (segundos)")).toBeInTheDocument();
    expect(screen.getByLabelText("Duración del examen (minutos)")).toHaveValue(60);
  });

  it("maps a 409 duplicate-name server error to a friendly message", async () => {
    // Production ApiError shape: status 409 + code RESOURCE_CONFLICT.
    const err = new ApiError(409, "El estado del recurso cambió", "RESOURCE_CONFLICT");
    vi.mocked(api.post).mockRejectedValueOnce(err);
    await act(async () => {
      renderPage();
    });
    await userEvent.type(screen.getByLabelText("Nombre de la plantilla"), "dup");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Ya existe una plantilla de política con ese nombre")).toBeInTheDocument();
  });
});

describe("ExamProfileEditPage — conditional fields", () => {
  it("hides maxAttempts when retakePolicy is not max_attempts", async () => {
    await act(async () => {
      renderPage();
    });
    // Default retakePolicy is unlimited → maxAttempts input absent.
    expect(screen.queryByLabelText("Máximo de intentos")).not.toBeInTheDocument();
  });

  it("shows maxAttempts when retakePolicy becomes max_attempts", async () => {
    await act(async () => {
      renderPage();
    });
    // Open the retake policy select (Radix combobox).
    await userEvent.click(screen.getByRole("combobox", { name: "Política de reintentos" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Cantidad limitada" }),
    );
    expect(await screen.findByLabelText("Máximo de intentos")).toBeInTheDocument();
  });

  it("hides grace caps when interruption policy is strict", async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.queryByLabelText("Tope de tiempo extra por interrupción (segundos)"),
    ).not.toBeInTheDocument();
  });

  it("shows grace caps when interruption policy becomes bounded_grace", async () => {
    await act(async () => {
      renderPage();
    });
    await userEvent.click(
      screen.getByRole("combobox", { name: "Política si se interrumpe" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Tiempo extra limitado" }),
    );
    expect(
      await screen.findByLabelText("Tope de tiempo extra por interrupción (segundos)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tope acumulado de tiempo extra (segundos)")).toBeInTheDocument();
  });
});

describe("ExamProfileEditPage — edit path", () => {
  it("loads the existing profile into the form", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(existing);
    await act(async () => {
      renderPage("/admin/exam-profiles/p-1/edit");
    });
    expect(
      await screen.findByRole("heading", { name: "Editar plantilla de política" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Duración del examen (minutos)")).toHaveValue(90);
    expect(screen.getByLabelText("Nombre de la plantilla")).toHaveValue("Examen en línea estándar");
  });

  it("retry after a load failure clears the stale error and renders the form", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new ApiError(500, "load failed", "INTERNAL"))
      .mockResolvedValueOnce(existing);
    await act(async () => {
      renderPage("/admin/exam-profiles/p-1/edit");
    });
    expect(
      await screen.findByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    // A successful retry renders the loaded form (ErrorState is gone).
    expect(await screen.findByLabelText("Nombre de la plantilla")).toHaveValue(
      "Examen en línea estándar",
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("patches on save", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(existing);
    vi.mocked(api.patch).mockResolvedValueOnce(existing);
    await act(async () => {
      renderPage("/admin/exam-profiles/p-1/edit");
    });
    await screen.findByRole("heading", { name: "Editar plantilla de política" });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(api.patch).toHaveBeenCalledWith(
      "/api/exam-profiles/p-1",
      expect.objectContaining({ name: "Examen en línea estándar", durationMinutes: 90 }),
    );
  });
});
