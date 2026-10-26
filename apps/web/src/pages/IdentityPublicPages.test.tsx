import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { InviteAcceptPage } from "./InviteAcceptPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));

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
    post: (...args: unknown[]) => apiPost(...args),
  },
  setNavigate: () => {},
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {path.startsWith("/forgot-password") ? (
        <ForgotPasswordPage />
      ) : path.startsWith("/reset-password") ? (
        <ResetPasswordPage />
      ) : (
        <InviteAcceptPage />
      )}
    </MemoryRouter>,
  );
}

describe("public identity pages (#297)", () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  it("forgot-password: empty username shows a field error, valid username sends a request", async () => {
    renderAt("/forgot-password");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enviar enlace de restablecimiento" }));
    expect(await screen.findByText("Ingresa el usuario")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();

    apiPost.mockResolvedValueOnce({ ok: true });
    await user.type(screen.getByLabelText("Usuario"), "someone");
    await user.click(screen.getByRole("button", { name: "Enviar enlace de restablecimiento" }));
    await waitFor(() =>
      expect(screen.getByTestId("forgot-password-sent")).toBeInTheDocument(),
    );
    expect(apiPost).toHaveBeenCalledWith("/api/auth/password-reset/request", {
      username: "someone",
    });
  });

  it("forgot-password keeps the confirmation generic even on rejection", async () => {
    apiPost.mockRejectedValueOnce(new Error("El link para restablecer la contraseña no sirve o venció"));
    renderAt("/forgot-password");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Usuario"), "someone");
    await user.click(screen.getByRole("button", { name: "Enviar enlace de restablecimiento" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // No success view: a genuine request failure must not fake success.
    expect(screen.queryByTestId("forgot-password-sent")).toBeNull();
  });

  it("invite-accept: posts the URL token and shows the success state", async () => {
    apiPost.mockResolvedValueOnce({
      user: { id: "u1", username: "invited", name: "受邀", role: "Teacher" },
    });
    renderAt("/invite/accept?token=abc123abc123abc123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Usuario"), "invited");
    await user.type(screen.getByLabelText("Nombre"), "受邀");
    await user.type(screen.getByLabelText("Definir contraseña"), "Sup3rSecret!");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Sup3rSecret!");
    await user.click(screen.getByRole("button", { name: "Activar cuenta" }));

    await waitFor(() =>
      expect(screen.getByTestId("invite-accept-success")).toBeInTheDocument(),
    );
    expect(apiPost).toHaveBeenCalledWith("/api/auth/invitations/accept", {
      token: "abc123abc123abc123",
      username: "invited",
      name: "受邀",
      password: "Sup3rSecret!",
    });
  });

  it("invite-accept: mismatched confirmation blocks submission", async () => {
    renderAt("/invite/accept?token=abc123abc123abc123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Usuario"), "invited");
    await user.type(screen.getByLabelText("Nombre"), "受邀");
    await user.type(screen.getByLabelText("Definir contraseña"), "Sup3rSecret!");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Different1!");
    await user.click(screen.getByRole("button", { name: "Activar cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("reset-password: posts the URL token and shows the success state", async () => {
    apiPost.mockResolvedValueOnce({ ok: true });
    renderAt("/reset-password?token=tok123tok123tok123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Contraseña nueva"), "NewPassword1!");
    await user.type(screen.getByLabelText("Confirmar contraseña nueva"), "NewPassword1!");
    await user.click(screen.getByRole("button", { name: "Restablecer contraseña" }));

    await waitFor(() =>
      expect(screen.getByTestId("reset-password-success")).toBeInTheDocument(),
    );
    expect(apiPost).toHaveBeenCalledWith("/api/auth/password-reset/consume", {
      token: "tok123tok123tok123",
      password: "NewPassword1!",
    });
  });
});
