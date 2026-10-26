// Identity lifecycle Email renderers.
//
// Pure functions over structured payloads, following the
// `renderGradeNotificationEmail` content boundary: server-generated
// zh-CN copy, a single trusted absolute link, and NO secret other than the
// token link itself — the raw token exists only in the delivered body, never
// in audit payloads or application logs. There is deliberately NO template
// engine / backend i18n runtime (ADR-011 §24).

import type { RenderedEmailContent } from "../email/renderedEmail.js";
import { escapeEmailHtml } from "../email/renderedEmail.js";
import type { StaffInvitationRole } from "@exam/contracts";

/** Structured input to the staff-invitation renderer. */
export interface StaffInvitationEmailPayload {
  /**
   * Invited staff role. INVARIANT: this is the closed `StaffInvitationRole`
   * contract enforced by `CreateStaffInvitationRequestSchema` at the wire
   * boundary — the renderer has no raw-string fallback path.
   */
  role: StaffInvitationRole;
  /** Absolute acceptance URL from `buildInviteAcceptLink`. */
  acceptUrl: string;
  /** Invitation validity in whole days (display only). */
  expiresInDays: number;
}

/** Structured input to the password-reset renderer. */
export interface PasswordResetEmailPayload {
  /** Absolute reset URL from `buildPasswordResetLink`. */
  resetUrl: string;
  /** Token validity in whole minutes (display only). */
  expiresInMinutes: number;
}

/**
 * zh-CN display labels for invitable staff roles. Mirrors the web locale
 * labels (`admin.users.roleLabels`) so email copy and UI copy agree; kept
 * local because server Email copy cannot import the web app's i18n.
 * Typed as the closed role contract so a missing label is a compile error
 * and the raw role key can never reach the rendered Email.
 */
export const STAFF_ROLE_LABELS_ZH: Record<StaffInvitationRole, string> = {
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  Admin: "Administrador de exámenes",
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  Teacher: "Docente",
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  Proctor: "Supervisor",
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  Grader: "Corrector",
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  Maintainer: "Operaciones del sistema",
};

/** Renders the staff-invitation Email content. */
export function renderStaffInvitationEmail(
  payload: StaffInvitationEmailPayload,
): RenderedEmailContent {
  const roleLabel = STAFF_ROLE_LABELS_ZH[payload.role];
  const link = payload.acceptUrl;
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  const subject = "Invitación a Aki";
  const bodyText =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Te invitaron a Aki. Rol: ${roleLabel}.\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Abre este enlace para activar la cuenta (${payload.expiresInDays} días, un solo uso):\n` +
    `${link}\n\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Si no esperabas este mensaje, ignóralo.`;
  const bodyHtml =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p>Te invitaron a Aki. Rol: <strong>${escapeEmailHtml(roleLabel)}</strong>.</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p><a href="${escapeEmailHtml(link)}">Activar la cuenta</a> (${payload.expiresInDays} días, un solo uso)</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p style="color:#888;font-size:12px;">Si no esperabas este mensaje, ignóralo.</p>`;
  return { subject, bodyText, bodyHtml };
}

/** Renders the password-reset Email content. */
export function renderPasswordResetEmail(
  payload: PasswordResetEmailPayload,
): RenderedEmailContent {
  const link = payload.resetUrl;
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  const subject = "Restablecer contraseña";
  const bodyText =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Pediste restablecer la contraseña.\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Abre este enlace para elegir una nueva (${payload.expiresInMinutes} minutos, un solo uso):\n` +
    `${link}\n\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Si no pediste esto, ignora el mensaje. La cuenta no cambia.`;
  const bodyHtml =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p>Pediste restablecer la contraseña.</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p><a href="${escapeEmailHtml(link)}">Elegir una contraseña nueva</a> (${payload.expiresInMinutes} minutos, un solo uso)</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p style="color:#888;font-size:12px;">Si no pediste esto, ignora el mensaje. La cuenta no cambia.</p>`;
  return { subject, bodyText, bodyHtml };
}
