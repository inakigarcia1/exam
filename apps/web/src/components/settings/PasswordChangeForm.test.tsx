import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { api, ApiError } from "@/lib/api";

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
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("PasswordChangeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("shows error when passwords do not match", async () => {
    render(<PasswordChangeForm />);
    const { toast } = await import("sonner");
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "old123");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "new123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña nueva"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(toast.error).toHaveBeenCalledWith("Las contraseñas nuevas no coinciden");
  });

  it("submits, shows success toast, logs out and redirects to /login", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ ok: true });
    vi.mocked(api.post).mockResolvedValueOnce(undefined);
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign },
      writable: true,
    });
    render(<PasswordChangeForm />);
    const { toast } = await import("sonner");
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "old12345");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "newpass123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña nueva"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(api.patch).toHaveBeenCalledWith("/api/auth/me/password", {
      currentPassword: "old12345",
      newPassword: "newpass123",
    });
    expect(toast.success).toHaveBeenCalledWith("La contraseña se actualizó");
    // Token revocation: a successful change ends the session client-side too.
    expect(api.post).toHaveBeenCalledWith("/api/auth/logout");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  });

  it("rejects new password shorter than the policy minimum", async () => {
    render(<PasswordChangeForm />);
    const { toast } = await import("sonner");
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "old12345");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "short12");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña nueva"), "short12");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(toast.error).toHaveBeenCalledWith("新密码至少 8 位");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shows error toast on API failure", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(
      new ApiError(400, "La contraseña actual no es correcta", "CURRENT_PASSWORD_INVALID"),
    );
    render(<PasswordChangeForm />);
    const { toast } = await import("sonner");
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "old12345");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "newpass123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña nueva"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(toast.error).toHaveBeenCalledWith("La contraseña actual no es correcta");
  });
});
