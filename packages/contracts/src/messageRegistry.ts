import type { SaveAnswerRejectReason } from "./attempt.js";

/**
 * INVARIANT: this registry is the single-locale (zh-CN) server default
 * compatibility catalog for top-level `error.message` (message contract
 * D0.5/D0.11 Zone B). It is not a localization framework: browser-visible
 * known semantics resolve through Web i18n, and locale-parameterized
 * lookup machinery has no legitimate consumer.
 */
export const errorMessages = {
  AUTH_REQUIRED: "Inicia sesión",
  AUTH_INVALID_CREDENTIALS: "Usuario o contraseña incorrectos",
  PERMISSION_DENIED: "No tienes permiso para hacer esto",
  VALIDATION_ERROR: "Los datos no son válidos",
  RESOURCE_NOT_FOUND: "No existe",
  RESOURCE_CONFLICT: "El estado del recurso cambió",
  INVALID_CURSOR: "El cursor de paginación no es válido",
  EXPORT_EXCEEDS_LIMIT:
    "Hay demasiados registros para exportar de una vez. Reduce la búsqueda",
  RATE_LIMITED: "Demasiados pedidos. Prueba de nuevo en un rato",
  INTERNAL_ERROR: "Error interno del servidor",
  CURRENT_PASSWORD_INVALID: "La contraseña actual no es correcta",
  USER_ALREADY_EXISTS: "Ese usuario ya existe",
  ADMIN_ALREADY_EXISTS: "Ya hay un administrador activo",
  CANDIDATE_IDENTITY_CONFLICT: "Esos datos de identidad ya existen",
  CANDIDATE_FIELD_IN_USE:
    "Ese campo de identidad está en uso y no se puede borrar",
  CANDIDATE_IDENTITY_FIELD_CONFLICT:
    "Solo puede haber un campo de identidad único",
  INVALID_STATE_TRANSITION: "En este estado no se puede hacer eso",
  ATTEMPT_ALREADY_STARTED: "El intento ya empezó",
  ATTEMPT_CLOSED: "El examen ya terminó",
  ANSWER_VERSION_CONFLICT: "La versión de la respuesta no coincide",
  EXAM_NOT_OPEN: "El examen todavía no está abierto",
  ATTEMPT_DEADLINE_EXCEEDED: "Se acabó el tiempo",
  DEADLINE_EXCEEDS_EXAM_CLOSE:
    "El nuevo límite no puede pasar del cierre del examen",
  EXAM_ALREADY_PUBLISHED: "El examen ya está publicado",
  EXAM_NOT_DRAFT: "Esto solo se puede hacer en borrador",
  EXAM_CLOSE_NOT_ALLOWED: "En este estado no se puede cerrar el examen",
  EXAM_ARCHIVE_NOT_ALLOWED: "En este estado no se puede archivar el examen",
  EXAM_UNPUBLISH_NOT_ALLOWED: "Un examen abierto no se puede despublicar",
  EXAM_EXTEND_NOT_ALLOWED: "En este estado no se puede extender el examen",
  EXAM_UPDATE_NOT_ALLOWED: "En este estado no se puede modificar el examen",
  EXAM_CANCEL_NOT_ALLOWED: "En este estado no se puede cancelar el examen",
  EXAM_PUBLISH_RESULTS_NOT_ALLOWED:
    "En este estado no se pueden publicar las calificaciones",
  EXAM_CANCELED_RESULTS_UNAVAILABLE:
    "Un examen cancelado no tiene calificaciones",
  ATTEMPT_SUBMIT_TOO_EARLY: "Todavía no se puede entregar",
  ATTEMPT_LATE_ENTRY_CLOSED: "Ya pasó el horario límite para entrar",
  ATTEMPT_START_SUBMIT_INFEASIBLE:
    "No queda tiempo suficiente para empezar un intento nuevo",
  ENROLLMENT_NOT_REMOVABLE: "No se puede quitar una inscripción ya empezada",
  SIMULTANEOUS_ACCESS_BLOCKED:
    "Ya hay una sesión rindiendo este examen. Pedile al docente que revoque la sesión",
  MAX_ATTEMPTS_REACHED: "Ya usaste todos los intentos",
  EXAM_ALREADY_PASSED: "Este examen ya está aprobado",
  IDEMPOTENCY_CONFLICT: "Ese identificador ya se usó en otro pedido",
  INCIDENT_VERSION_CONFLICT: "El incidente cambió. Actualiza la página",
  INCIDENT_ACTION_ALREADY_LINKED:
    "Esa acción ya está vinculada a otro incidente",
  CSRF_ORIGIN_REJECTED: "El origen del pedido no está permitido",
  AUTH_REGISTER_DISABLED: "No hay registro público",
  LAUNCHPAD_ALREADY_INITIALIZED:
    "El sistema ya está inicializado. Entra con tu usuario",
  LAUNCHPAD_INVALID_SETUP_TOKEN: "El token de inicialización no es válido",
  PASSWORD_RESET_TARGET_ROLE_NOT_ALLOWED:
    "No se puede restablecer la contraseña de ese rol",
  INVITATION_INVALID: "El link de invitación no sirve o venció",
  PASSWORD_RESET_INVALID:
    "El link para restablecer la contraseña no sirve o venció",
  AUTHZ_UNAVAILABLE: "La autorización no está disponible. Prueba de nuevo",
  RATE_LIMIT_UNAVAILABLE:
    "El límite de pedidos no está disponible. Prueba de nuevo",
} as const;

/** Union type of all valid error message codes. */
export type ErrorCode = keyof typeof errorMessages;

/**
 * Type guard that checks whether a string is a valid error code.
 * @param code - The string to check.
 * @returns `true` if the code exists in the errorMessages registry.
 */
export function isErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(errorMessages, code);
}

/**
 * Returns the server default compatibility message for the given error code
 * (message contract D0.5). Producers use this for top-level `error.message`;
 * clients must not parse it.
 * @param code - A valid error code from the errorMessages registry.
 * @returns The compatibility message string.
 */
export function getErrorMessage(code: ErrorCode): string {
  return errorMessages[code];
}

/**
 * Validation messages for candidate identity fields.
 * Includes a static configuration message and per-field label functions.
 */
export const candidateFieldValidationMessages = {
  configurationInvalid:
    "La configuración de los campos de identidad no es válida",
  required: (label: string) => `${label}为必填项`,
  numberRequired: (label: string) => `${label}必须为数字`,
  textRequired: (label: string) => `${label}必须为文本`,
};

/**
 * User-facing messages for each save-answer rejection reason.
 */
export const saveAnswerMessages: Record<SaveAnswerRejectReason, string> = {
  STALE_VERSION: "En el servidor hay una versión más nueva de la respuesta",
  FUTURE_VERSION: "La versión de la respuesta se adelantó. Actualiza la página",
  ATTEMPT_ALREADY_SUBMITTED:
    "El examen ya se entregó y no se puede seguir guardando",
  ATTEMPT_CLOSED: "El examen ya terminó",
  DEADLINE_EXCEEDED: "Se acabó el tiempo",
  CONFLICTING_PAYLOAD: "Los datos de la respuesta chocan. Actualiza la página",
  INVALID_ANSWER: "La respuesta no tiene el formato de esta pregunta",
};

/**
 * Returns the user-facing message for a given save-answer rejection reason.
 * @param reason - The rejection reason from the save-answer protocol.
 * @returns The corresponding error message string.
 */
export function getSaveAnswerMessage(reason: SaveAnswerRejectReason): string {
  return saveAnswerMessages[reason];
}
