// grade_notification Email renderer.
//
// The renderer is a PURE function over a structured payload. It does NOT
// query repositories, does NOT call SMTP, and does NOT depend on Fastify.
// The caller (NotificationService) is responsible for:
//   - building the payload from trusted sources (exam title from Exam row;
//     actionPath from buildResultPublishedActionPath)
//   - combining the actionPath with PUBLIC_WEB_ORIGIN via
//     buildAbsoluteNotificationLink BEFORE passing the absolute URL here
//
// Content boundary:
//   subject: "考试结果已发布" (server-generated zh-CN)
//   body:    examTitle (HTML-escaped) + a trusted link back to EXAM
//   MUST NOT include: score, pass/fail, standard answers, rubric, grader
//   identity. Those live inside EXAM (Inbox + result page), never the Email.

import type { RenderedEmailContent } from "../email/renderedEmail.js";
import { escapeEmailHtml } from "../email/renderedEmail.js";

/** Structured input to the grade_notification renderer. */
export interface GradeNotificationPayload {
  /** Server-trusted exam title (HTML-escaped at render time). */
  examTitle: string;
  /**
   * Absolute result URL = PUBLIC_WEB_ORIGIN + validated action path. The
   * caller is responsible for combining via `buildAbsoluteNotificationLink` so the
   * renderer never sees a site-relative path or an unvalidated origin.
   */
  actionPath: string;
}

/**
 * Renders the grade_notification Email content from a structured payload.
 *
 * The output is server-generated zh-CN copy with the exam title interpolated
 * (escaped) and a single trusted link. No score, no pass/fail, no standard
 * answers, no rubric, no grader identity.
 */
export function renderGradeNotificationEmail(
  payload: GradeNotificationPayload,
): RenderedEmailContent {
  const examTitle = payload.examTitle;
  const link = payload.actionPath;
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  const subject = "Ya están las calificaciones";
  const bodyText =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Ya se publicaron las calificaciones de «${examTitle}».\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Míralas en Aki: ${link}\n\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `(Mensaje automático. No respondas.)`;
  const bodyHtml =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p>Ya se publicaron las calificaciones de «${escapeEmailHtml(examTitle)}».</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p><a href="${escapeEmailHtml(link)}">Ver el resultado</a></p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p style="color:#888;font-size:12px;">Mensaje automático. No respondas.</p>`;
  return { subject, bodyText, bodyHtml };
}
