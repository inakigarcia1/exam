import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../lib/login";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Staff invitation product loop through the real UI: Admin invites →
 * one-time acceptance link → logout → accept form → new account logs in.
 * The one-time link is surfaced by the InvitationsCard exactly once (the
 * server stores only the token hash), which is what makes the loop drivable
 * without an SMTP server.
 *
 * The full request→email→consume loop and the fail-closed acceptance/reset
 * states are owned by apps/api/src/routes/identityLifecycle.test.ts and the
 * page component tests.
 */

test.describe("staff invitation end to end", () => {
  test("admin invites → accept link → account activates → new staff logs in", async ({
    page,
  }) => {
    const stamp = Date.now();
    const email = `e2e-invite-${stamp}@example.com`;
    const username = `e2e-invited-${stamp}`;
    const password = "Invited#2026";

    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/users`);

    // Open the invitations panel dialog.
    await page.getByRole("button", { name: "Invitar" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.getByRole("option", { name: "Docente" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enviar invitación" })
      .click();

    // The one-time acceptance URL appears in the dialog.
    const urlField = page.getByTestId("invite-one-time-url").locator("input");
    await expect(urlField).toBeVisible();
    const acceptUrl = await urlField.inputValue();
    expect(acceptUrl).toContain("/invite/accept?token=");

    // Session is dropped: the token-carrier URL must work while logged out.
    await page.request.delete(`${BASE_URL}/api/auth/logout`).catch(() => {});
    await page.context().clearCookies();
    await page.goto(acceptUrl);

    await page.getByLabel("Usuario").fill(username);
    await page.getByLabel("Nombre", { exact: true }).fill("受邀教师");
    await page.getByLabel("Definir contraseña", { exact: true }).fill(password);
    await page.getByLabel("Confirmar contraseña").fill(password);
    await page.getByRole("button", { name: "Activar cuenta" }).click();
    await expect(page.getByTestId("invite-accept-success")).toBeVisible();

    // The new staff account logs in through the real login flow.
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel("Usuario").fill(username);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    // A Teacher lands on the capability-driven console surface.
    await page.waitForURL(/\/admin\/exams(?:$|[/?#])/, {
      timeout: 15_000,
    });
  });
});
