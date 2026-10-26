import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { permissionsForRole } from "@exam/authz";
import { LoginPage } from "./LoginPage";

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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/dashboard" element={<LocationProbe />} />
          <Route path="/exam/list" element={<LocationProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage smoke", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it("renders username and password fields and login button", () => {
    renderLogin();

    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("does not show login submitting state during session restore", () => {
    apiGet.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider restoreSession>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Ingresando..." }),
    ).not.toBeInTheDocument();
  });

  it("shows error message when login fails", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValueOnce(new Error("Usuario o contraseña incorrectos"));

    renderLogin();

    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Usuario o contraseña incorrectos");
    });
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();
    let resolveLogin!: (v: unknown) => void;
    apiPost.mockImplementationOnce(
      () => new Promise((resolve) => (resolveLogin = resolve)),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "admin123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("button", { name: "Ingresando..." })).toBeDisabled();

    resolveLogin!({
      id: "u1",
      username: "admin",
      name: "Admin",
      role: "Admin",
      organizationId: "org1",
      capabilities: [...permissionsForRole("Admin")],
    });
    await act(async () => {});
  });

  it("navigates to admin dashboard on admin login", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      name: "Admin",
      role: "Admin",
      organizationId: "org1",
      capabilities: [...permissionsForRole("Admin")],
    });

    renderLogin();

    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "admin123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "/admin/dashboard",
      );
    });
  });

  it("navigates to exam list on candidate login", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({
      id: "c1",
      username: "candidate",
      name: "Candidate",
      role: "Candidate",
      organizationId: "org1",
      capabilities: [...permissionsForRole("Candidate")],
    });

    renderLogin();

    await user.type(screen.getByLabelText("Usuario"), "candidate");
    await user.type(screen.getByLabelText("Contraseña"), "cand123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "/exam/list",
      );
    });
  });

  it("clears field error when user types after validation failure", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(screen.getByText("Ingresa el usuario")).toBeInTheDocument();
    expect(screen.getByText("Ingresa tu contraseña")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Usuario"), "admin");
    expect(screen.queryByText("Ingresa el usuario")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Contraseña"), "pass");
    expect(screen.queryByText("Ingresa tu contraseña")).not.toBeInTheDocument();
  });
});
