// exam_assigned Email renderer.
//
// Pure function over a structured payload, following the
// `renderGradeNotificationEmail` content boundary: server-generated
// zh-CN copy, a single trusted absolute link, and no leakage class beyond the
// exam title — no exam state, no questions, no rubric. The Inbox notification
// is the awareness channel; this Email is the offline recall.

import type { RenderedEmailContent } from "../email/renderedEmail.js";
import { escapeEmailHtml } from "../email/renderedEmail.js";

/** Structured input to the exam_assigned renderer. */
export interface ExamAssignedEmailPayload {
  /** Server-trusted exam title (HTML-escaped at render time). */
  examTitle: string;
  /**
   * Absolute exam-list URL = PUBLIC_WEB_ORIGIN + validated action path
   * (`/exam/list`). The caller is responsible for combining via
   * `buildAbsoluteNotificationLink` so the renderer never sees a
   * site-relative path or an unvalidated origin.
   */
  listUrl: string;
}

/**
 * Renders the exam_assigned Email content from a structured payload.
 *
 * The Inbox row remains the awareness + navigation authority; the Email copy
 * mirrors it (title + a pointer to the exam list) and deliberately does NOT
 * duplicate exam state.
 */
export function renderExamAssignedEmail(
  payload: ExamAssignedEmailPayload,
): RenderedEmailContent {
  const examTitle = payload.examTitle;
  const link = payload.listUrl;
  // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
  const subject = "Te asignaron un examen";
  const bodyText =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Te asignaron el examen «${examTitle}».\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `Entra a la lista en Aki: ${link}\n\n` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `(Mensaje automático. No respondas.)`;
  const bodyHtml =
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p>Te asignaron el examen «${escapeEmailHtml(examTitle)}».</p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p><a href="${escapeEmailHtml(link)}">Ver la lista de exámenes</a></p>` +
    // i18n-copy-allow: server-rendered — Email/Inbox copy rendered server-side; independent localization boundary, never routed through web i18n
    `<p style="color:#888;font-size:12px;">Mensaje automático. No respondas.</p>`;
  return { subject, bodyText, bodyHtml };
}
