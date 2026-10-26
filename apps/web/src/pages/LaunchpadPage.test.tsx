import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchpadPage } from "./LaunchpadPage";

import { ApiError } from "@/lib/api";

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

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

function renderLaunchpad() {
  return render(
    <MemoryRouter initialEntries={["/launchpad"]}>
      <Routes>
        <Route path="/launchpad" element={<LaunchpadPage />} />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LaunchpadPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it("redirects to /login when the installation is already initialized", async () => {
    apiGet.mockResolvedValueOnce({ initialized: true });

    renderLaunchpad();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
  });

  it("renders the first-Admin setup form when uninitialized", async () => {
    apiGet.mockResolvedValueOnce({ initialized: false });

    renderLaunchpad();

    await waitFor(() => {
      expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Nombre del administrador")).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario del administrador")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña del administrador")).toBeInTheDocument();
    expect(screen.getByLabelText("Token de configuración")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Terminar la configuración" }),
    ).toBeInTheDocument();
  });

  it("shows field validation errors and does not submit when fields are empty", async () => {
    apiGet.mockResolvedValueOnce({ initialized: false });
    const user = userEvent.setup();

    renderLaunchpad();
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Terminar la configuración" }));

    expect(screen.getByText("Ingresa el nombre de la organización")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el nombre del administrador")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el usuario del administrador")).toBeInTheDocument();
    expect(screen.getByText("Ingresa la contraseña del administrador")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el token de configuración")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("submits the bootstrap payload and redirects to /login on success", async () => {
    apiGet.mockResolvedValueOnce({ initialized: false });
    apiPost.mockResolvedValueOnce({
      ok: true,
      organizationSlug: "default",
      adminUsername: "newadmin",
    });
    const user = userEvent.setup();

    renderLaunchpad();
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Nombre de la organización"), "Fresh Org");
    await user.type(screen.getByLabelText("Nombre del administrador"), "New Admin");
    await user.type(screen.getByLabelText("Usuario del administrador"), "newadmin");
    await user.type(screen.getByLabelText("Contraseña del administrador"), "Strong-Admin-1!");
    await user.type(screen.getByLabelText("Token de configuración"), "the-setup-token");

    await user.click(screen.getByRole("button", { name: "Terminar la configuración" }));

    // The payload excludes organizationDisplayName when left blank and sends
    // the canonical field names the backend expects.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/launchpad/bootstrap", {
        organizationName: "Fresh Org",
        adminName: "New Admin",
        adminUsername: "newadmin",
        adminPassword: "Strong-Admin-1!",
        setupToken: "the-setup-token",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
  });

  it("shows an error banner and stays on /launchpad when bootstrap fails", async () => {
    apiGet.mockResolvedValueOnce({ initialized: false });
    apiPost.mockRejectedValueOnce(
      new ApiError(
        400,
        "El token de inicialización no es válido",
        "LAUNCHPAD_INVALID_SETUP_TOKEN",
      ),
    );
    const user = userEvent.setup();

    renderLaunchpad();
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Nombre de la organización"), "Fresh Org");
    await user.type(screen.getByLabelText("Nombre del administrador"), "New Admin");
    await user.type(screen.getByLabelText("Usuario del administrador"), "newadmin");
    await user.type(screen.getByLabelText("Contraseña del administrador"), "Strong-Admin-1!");
    await user.type(screen.getByLabelText("Token de configuración"), "wrong-token");

    await user.click(screen.getByRole("button", { name: "Terminar la configuración" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "El token de inicialización no es válido",
      );
    });
    // Still on /launchpad (no redirect).
    expect(screen.queryByTestId("current-path")).not.toBeInTheDocument();
    await act(async () => {});
  });
});
