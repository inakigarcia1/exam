/**
 * es translation catalog (the only supported locale).
 *
 * Keys are organized by domain. Status labels mirror `statusMeta` /
 * `constants` 1:1 so the UI layer can render them via `t()` while the
 * status *enum* and *tone/icon* metadata stay in `statusMeta.ts` (which stores
 * `labelKey`).
 *
 * Keep keys stable and grouped; do NOT delete a key without grepping usages.
 */

const es = {
  status: {
    exam: {
      draft: "Borrador",
      published: "Publicado",
      open: "Abierto",
      closed: "Cerrado",
      archived: "Archivado",
    },
    enrollment: {
      assigned: "Asignado",
      started: "Iniciado",
      completed: "Completados",
      blocked: "Bloqueado",
      not_started: "Sin empezar",
    },
    attempt: {
      queued: "En espera",
      in_progress: "Respondiendo",
      disrupted: "Desconectado",
      submitted: "Entregado",
      graded: "Calificado",
      voided: "Anulado",
    },
    incident: {
      open: "Pendiente",
      investigating: "En investigación",
      resolved: "Resuelto",
      dismissed: "Descartado",
    },
    save: {
      saving: "Guardando",
      saved: "Guardado",
      failed: "Fallos al guardar",
    },
    lifecycle: {
      canceled: "Cancelado",
      expired: "Vencida",
      stale: "Desactualizado",
    },
    connection: {
      connected: "Conectado",
      degraded: "Conexión inestable",
      offline: "Sin conexión",
    },
    health: {
      ok: "Normal",
      critical: "Crítico",
      unknown: "Desconocido",
    },
    infra: {
      available: "Disponible",
      connecting: "Conectando",
      degraded: "Degradado",
      unavailable: "No disponible",
      disabled: "Desactivado",
      unknown: "Desconocido",
    },
    account: {
      active: "Activo",
      inactive: "Desactivado",
    },
    result: {
      passed: "Aprobado",
      not_passed: "Desaprobado",
    },
    grading: {
      auto_graded: "Calificación automática",
      pending_manual: "Pendiente de corrección manual",
      fully_graded: "Calificación completa",
    },
    misconduct: {
      misconduct_warning: "Falta: aviso",
      misconduct_serious: "Falta: grave",
    },
    fallback: {
      unknown: "Desconocido",
    },
  },

  /**
   * Candidate exam-list availability labels (CandidateExamSummary).
   * Distinct from the attempt/exam/enrollment status grammar above — these
   * are the candidate-facing availability buckets shown on the exam list.
   */
  availability: {
    available: "Disponible",
    in_progress: "En curso",
    resumable: "Para retomar",
    submitted_pending_grade: "Por calificar",
    graded: "Calificado",
    max_attempts_exhausted: "Intentos agotados",
    not_started_yet: "Aún no abre",
    expired: "Vencida",
    unavailable: "No disponible",
  },

  questionType: {
    single_choice: "Opción única",
    multiple_choice: "Opción múltiple",
    fill_blank: "Completar",
    true_false: "Verdadero o falso",
    text_response: "Respuesta de texto",
  },

  /**
   * Rich content rendering (#301). The static ContentDocumentRenderer is a
   * closed-vocabulary fail-safe renderer: unknown nodes degrade to a notice,
   * they never reach raw HTML.
   */
  content: {
    unsupportedBlock:
      "Este contenido incluye elementos que esta versión no admite",
    unsupportedAnswer:
      "Esta respuesta no se puede mostrar como texto enriquecido",
    unsafeEditableAnswer: "Esta respuesta no se puede abrir para editarla",
    unsafeDocument: "Este contenido no se puede mostrar",
    mathLoading: "Cargando la fórmula",
    mode: {
      label: "Modo de contenido",
      optionLabel: "Modo de contenido de la opción {{id}}",
      plain: "Texto plano",
      rich: "Texto enriquecido",
    },
    confirmToPlain: {
      title: "¿Pasar a texto plano?",
      description:
        "Se pierde el formato (listas, tablas, fórmulas, negrita y más). Solo queda el texto.",
      confirm: "Convertir y quitar el formato",
      cancel: "Cancelar",
    },
    editor: {
      label: "Editor de texto enriquecido",
      loading: "Cargando el editor…",
      toolbarLabel: "Herramientas de respuesta",
      moreCommands: "Más herramientas",
      undo: "Revocar",
      redo: "Rehacer",
      bold: "Negrita",
      italic: "Cursiva",
      underline: "Subrayado",
      inlineCode: "Código en línea",
      bulletList: "Lista con viñetas",
      orderedList: "Lista numerada",
      codeBlock: "Bloque de código",
      table: "Tabla",
      formula: "Fórmula",
    },
    formula: {
      atomLabel: "Fórmula {{latex}}",
      insertTitle: "Insertar fórmula",
      editTitle: "Editar fórmula",
      description:
        "Escribe los símbolos, o abre el código de abajo para editar el LaTeX.",
      modeLabel: "Visualización",
      modeInline: "En línea",
      modeBlock: "En bloque",
      modeBlockUnavailableHint:
        "En este lugar no se puede mostrar en bloque (dentro de una lista o una tabla). La fórmula se guarda en línea.",
      expertShow: "Código LaTeX",
      expertHide: "Ocultar código",
      expertLabel: "Código LaTeX",
      previewLabel: "Vista previa",
      previewEmpty: "(Vacío)",
      renderWarningNote:
        "Si la vista previa no se ve completa, el código se conserva tal cual y se guarda con la respuesta.",
      confirm: "Confirmar",
      cancel: "Cancelar",
    },
    table: {
      controlsLabel: "Acciones de la tabla",
      addRowAbove: "Insertar fila arriba",
      addRowBelow: "Insertar fila abajo",
      addColumnLeft: "Insertar columna a la izquierda",
      addColumnRight: "Insertar columna a la derecha",
      deleteRow: "Eliminar esta fila",
      deleteColumn: "Eliminar esta columna",
      deleteTable: "Eliminar tabla",
    },
  },

  /**
   * Global error / toast / notify messages. API error *codes* stay machine
   * semantic (contracts/messageRegistry); these are the generic UI-facing
   * fallbacks and common mutation success/failure toasts.
   *
   * `codes` / `reasons` are the Web-owned presentation catalog for known
   * machine semantics (message contract D0.11 Zone A, C3): the active Web
   * i18n instance renders known ErrorCode / details.reason values, and the
   * server compatibility message is only the unknown-semantics fallback.
   */
  errors: {
    network: "No hay conexión. Inténtalo más tarde.",
    unknown: "No se pudo completar la acción. Inténtalo de nuevo más tarde.",
    codes: {
      authRequired: "Tenés que iniciar sesión",
      authInvalidCredentials: "Usuario o contraseña incorrectos",
      permissionDenied: "No tienes permiso para hacer esto",
      validationError: "Hay datos incorrectos. Revísalos e inténtalo de nuevo.",
      resourceNotFound: "No existe o ya se eliminó",
      resourceConflict: "El estado cambió. Actualiza e inténtalo de nuevo.",
      invalidCursor: "La paginación no es válida",
      exportExceedsLimit:
        "Son demasiados registros para exportar de una vez. Acota la búsqueda.",
      rateLimited: "Demasiadas solicitudes. Inténtalo más tarde.",
      internalError: "Error interno del servidor. Inténtalo más tarde.",
      currentPasswordInvalid: "La contraseña actual no es correcta",
      userAlreadyExists: "Ese usuario ya existe",
      adminAlreadyExists: "Ya existe un administrador activo",
      candidateIdentityConflict: "Esos datos de identidad ya existen",
      candidateFieldInUse:
        "Ese campo de identidad está en uso y no se puede eliminar",
      candidateIdentityFieldConflict:
        "Solo se puede marcar un campo de identidad como único",
      invalidStateTransition:
        "Esta acción no está permitida en el estado actual",
      attemptAlreadyStarted: "El intento ya empezó",
      attemptClosed: "El examen ya terminó",
      answerVersionConflict:
        "La respuesta cambió en el servidor. Actualiza e inténtalo de nuevo.",
      examNotOpen: "El examen no está abierto en este momento",
      attemptDeadlineExceeded: "Se acabó el tiempo del examen",
      deadlineExceedsExamClose:
        "La nueva hora límite no puede pasar del cierre del examen",
      examAlreadyPublished: "El examen ya está publicado",
      examNotDraft: "Esto solo se puede hacer con un examen en borrador",
      examCloseNotAllowed: "No se puede cerrar el examen en este estado",
      examArchiveNotAllowed: "No se puede archivar el examen en este estado",
      examUnpublishNotAllowed:
        "No se puede retirar un examen que ya está abierto",
      examExtendNotAllowed: "No se puede extender el examen en este estado",
      examUpdateNotAllowed: "No se puede modificar el examen en este estado",
      examCancelNotAllowed: "No se puede cancelar el examen en este estado",
      examPublishResultsNotAllowed:
        "No se pueden publicar las calificaciones en este estado",
      examCanceledResultsUnavailable:
        "Un examen cancelado no tiene calificación",
      attemptSubmitTooEarly:
        "Empezó hace muy poco. Todavía no puedes entregar.",
      attemptLateEntryClosed: "Ya pasó la hora límite para entrar",
      attemptStartSubmitInfeasible:
        "No queda tiempo suficiente para el mínimo de respuesta. No puedes empezar otro intento.",
      enrollmentNotRemovable:
        "No se puede quitar una inscripción que ya empezó",
      simultaneousAccessBlocked:
        "Ya hay una sesión rindiendo este examen. Pedile al docente que revoque la sesión",
      maxAttemptsReached: "Llegaste al máximo de intentos",
      examAlreadyPassed: "Ya aprobaste este examen",
      idempotencyConflict: "Esta solicitud entra en conflicto con una anterior",
      incidentVersionConflict:
        "Hay un conflicto de versión del incidente. Actualiza e inténtalo de nuevo.",
      incidentActionAlreadyLinked:
        "Esa acción ya está vinculada a otro incidente",
      csrfOriginRejected: "El origen de la solicitud no está permitido",
      authRegisterDisabled: "El registro no está habilitado",
      launchpadAlreadyInitialized: "El sistema ya está listo. Inicia sesión.",
      launchpadInvalidSetupToken:
        "El token de inicialización no es válido o no está configurado",
      passwordResetTargetRoleNotAllowed:
        "No se puede restablecer la contraseña de un usuario con ese rol",
      invitationInvalid: "El enlace de invitación no es válido o ya venció",
      passwordResetInvalid:
        "El enlace para restablecer no es válido o ya venció",
      authzUnavailable:
        "La autorización no está disponible. Inténtalo más tarde.",
      rateLimitUnavailable:
        "El control de solicitudes no está disponible. Inténtalo más tarde.",
    },
    /**
     * (ErrorCode, details.reason) specific copy. Context-neutral by design:
     * one reason may surface on several pages (e.g. UNRESOLVED_ATTEMPTS_EXIST
     * blocks score view, export, and exam cancel alike).
     */
    reasons: {
      courseCodeExists: "Ese código de comisión ya existe",
      courseHasQuestions:
        "Esta comisión todavía tiene {{questionCount}} preguntas y no se puede eliminar",
      examProfileNameExists: "Ese nombre ya está en uso",
      examNotFinished: "El examen todavía no terminó",
      unresolvedAttemptsExist:
        "Todavía hay {{activeAttemptCount}} intentos sin terminar",
      cannotDisableSelf: "No puedes desactivar tu propia cuenta",
      targetUserInactive: "Ese usuario está desactivado",
      targetNotTeacher: "Ese usuario no es docente",
      targetNotGrader: "Ese usuario no es corrector",
      adminMaintainerExclusion:
        "La misma cuenta no puede ser administrador y de operaciones",
    },
  },

  toast: {
    saved: "Guardado",
    saveFailed: "Fallos al guardar",
    submitted: "Entregado",
    submitFailed: "Fallos al enviar",
    deleted: "Eliminado",
    deleteFailed: "No se pudo eliminar",
    updated: "Actualizado",
    updateFailed: "No se pudo actualizar",
    created: "Creado",
    createFailed: "No se pudo crear",
  },

  common: {
    retry: "Reintentar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    close: "Cerrar",
    delete: "Eliminar",
    save: "Guardar",
    submit: "Enviar",
    loading: "Cargando…",
    /** LoadingState default label (three dots, distinct from common.loading's ellipsis char). */
    loadingState: "Cargando...",
    empty: "No hay datos",
    rowActions: "Acciones de la fila",
    /** RowActions overflow-menu (kebab) trigger label. */
    moreActions: "Más acciones",
    /** SearchInput defaults. */
    search: {
      placeholder: "Buscar",
      clearLabel: "Borrar búsqueda",
    },
    /** DataToolbar default aria-label. */
    toolbar: {
      dataLabel: "Barra de datos",
    },
    /** DataTablePagination copy with interpolation. */
    table: {
      summary: "{{total}} en total, se muestran {{start}}-{{end}}",
      /**
       * Footer summary while a NEW query identity is pending: the previous
       * query's count is not this query's fact, so it is not shown until its
       * own response lands (#784 OD3).
       */
      pendingSummary: "Buscando…",
      prev: "Página anterior",
      next: "Página siguiente",
      pageLabel: "Página {{page}}",
      paginationLabel: "Paginación",
      scrollHintRight: "Desliza a la derecha para ver más",
      scrollHintBoth: "Desliza hacia los lados para ver más",
      scrollHintLeft: "Desliza a la izquierda para ver más",
    },
    /** DataWorkbench region label (screen-reader-only section heading). */
    workbench: {
      regionLabel: "Mesa de preguntas",
    },
    /** Tag overflow chip (+N) aria-label with count interpolation. */
    moreTags: "{{count}} etiquetas más",
    /** DatePicker default placeholder. */
    date: {
      placeholder: "Elegir fecha",
    },
    /** Duration token labels used by formatDurationParts / formatDuration. */
    duration: {
      millisecond: "{{value}}ms",
      second: "{{value}} segundos",
      minute: "{{value}} minutos",
      minuteSecond: "{{minutes}} minutos {{seconds}} segundos",
      hour: "{{value}} horas",
      hourMinute: "{{hours}} horas {{minutes}} minutos",
    },
    /** ErrorBoundary copy. */
    errorBoundary: {
      title: "Error del sistema",
      description: "Ocurrió un error inesperado.",
      retryHint:
        "Vuelve a cargar la página. Si el problema sigue, contacta al administrador.",
      details: "Ver detalles",
      reload: "Volver a cargar",
    },
    /** Boolean display labels (yes/no), reused across components. */
    boolean: {
      yes: "Sí",
      no: "No",
    },
  },

  validation: {
    required: "Este campo es obligatorio",
    passwordMismatch: "Las contraseñas nuevas no coinciden",
    passwordMin: "La contraseña nueva debe tener al menos {{min}} caracteres",
    passwordChangeSuccess: "La contraseña se actualizó",
    passwordChangeFailed: "No se pudo cambiar la contraseña",
    passwordMinChars: "Al menos {{min}} caracteres",
    /** C2 field-violation codes (message contract D0.7). Keyed by the wire
     * machine code; codes without an entry fall back to the server
     * compatibility message, so server wording is never authoritative. */
    field: {
      fallback: "Revisa este campo e inténtalo de nuevo.",
      REQUIRED: "{{label}} es obligatorio",
      INVALID_TYPE: "El tipo de este campo no es válido",
      // WHY: the wire params carry only minimum/maximum — the Zod constraint
      // dimensions (type/inclusive/exact) never cross the wire — so numeric
      // inequality wording would fabricate a constraint (e.g. positive()
      // emits minimum 0 with an exclusive bound). Copy stays generic-safe.
      TOO_SMALL: "Este campo no cumple el mínimo permitido",
      TOO_BIG: "Este campo no cumple el máximo permitido",
      INVALID_STRING: "El formato de este campo no es válido",
      INVALID_ENUM_VALUE: "Este valor no está permitido",
      UNRECOGNIZED_KEYS: "Hay campos que no se admiten",
      IDENTITY_FIELD_CONFIGURATION:
        "La configuración del campo de identidad del alumno no es válida",
      RESOURCE_NOT_FOUND: "{{resource}} no existe",
      QUESTION_COURSE_MISMATCH:
        "La pregunta no pertenece a la comisión elegida",
      resources: {
        course: "Comisión",
        examProfile: "Plantilla de reglas del examen",
        question: "Pregunta",
      },
    },
  },

  passwordChange: {
    title: "Cambiar contraseña",
    currentLabel: "Contraseña actual",
    newLabel: "Contraseña nueva",
    confirmLabel: "Confirmar contraseña nueva",
    saving: "Cambiando...",
    button: "Cambiar contraseña",
  },

  /** AppSidebar / navigation labels. Mirrors the sidebar structure 1:1. */
  nav: {
    groups: {
      overview: "Resumen",
      questionBank: "Banco de preguntas",
      exams: "Exámenes",
      monitoring: "Supervisión",
      recovery: "Recuperación y resolución",
      operations: "Operaciones",
      management: "Administración",
    },
    items: {
      dashboard: "Panel",
      operations: "Resumen de operaciones",
      courses: "Comisiones",
      subjects: "Materias",
      questions: "Preguntas",
      questionsImport: "Importar preguntas",
      exams: "Exámenes",
      examProfiles: "Plantillas de reglas",
      gradingQueue: "Por calificar",
      results: "Calificaciones",
      proctorWorkspace: "Mesa de supervisión",
      recoveryQueue: "Revisión de recuperación",
      proctorRecovery: "Resolución de supervisión",
      users: "Usuarios",
      candidates: "Alumnos",
      importLogs: "Registro de importaciones",
      auditLogs: "Registro de auditoría",
      permissions: "Registro de permisos",
      settings: "Configuración de la plataforma",
      candidateFields: "Campos del alumno",
      system: "Monitoreo del sistema",
    },
    actions: {
      collapse: "Contraer la barra lateral",
      expand: "Expandir la barra lateral",
      logout: "Cerrar sesión",
      logoutShort: "Salir",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      menuTitle: "Menú de navegación",
      menuDescription: "Elige una página.",
    },
  },

  /** Operations surface copy (Admin business-owner summary +
   *  Application Maintainer detail). */
  ops: {
    title: "Resumen de operaciones",
    subtitle: "Estado del sistema y diagnóstico",
    staleWarning:
      "No se pudieron actualizar los datos. Se muestra la última carga correcta.",
    errors: {
      loadFailed: "No se pudieron cargar los datos de operaciones",
    },
    health: {
      section: "Salud del sistema",
      status: "Estado general",
      statusValue: { ok: "Normal", degraded: "Degradado", critical: "Crítico" },
      cpu: "Uso de CPU",
      memory: "Uso de memoria",
      dbLatency: "Latencia de la base de datos",
    },
    diagnostics: {
      section: "Diagnóstico de ejecución",
      title: "Estado de ejecución",
      dbLatency: "Latencia de la base de datos",
      redis: "Redis",
      heartbeatScanner: "Escaneo de latidos",
      deadlineScanner: "Escaneo de plazos",
      emailWorker: "Worker de correo",
    },
  },

  /** Admin-console route guard (403 / Access-Denied) copy. */
  adminRouteGuard: {
    accessDenied: "No tienes permiso para ver esta página.",
    backToPermitted: "Volver a una página permitida",
  },

  /** ExamListPage (candidate-facing exam list) copy. */
  examList: {
    actions: {
      start: "Comenzar examen",
      resume: "Continuar examen",
      viewResult: "Ver calificación",
      viewHistory: "Ver historial",
    },
    /** Card metadata with interpolation. i18next interpolation: {{value}}. */
    meta: {
      duration: "{{minutes}} minutos",
      noDuration: "Sin límite de tiempo",
      deadline: "Con hora límite",
      noEnd: "Sin límite de tiempo",
      passingScore: "Para aprobar: {{score}}/{{total}}",
      questionCount: "Preguntas: {{count}}",
      attempts: "Intentos: {{used}}/{{max}}",
      unavailable: "No disponible",
    },
    sections: {
      canTake: "Exámenes disponibles",
      history: "Exámenes anteriores",
      upcoming: "Próximos",
    },
    empty: {
      title: "No hay exámenes disponibles",
      description: "Ahora no hay exámenes para rendir.",
    },
    errors: {
      loadFailed: "No se pudo cargar la lista de exámenes",
    },
  },

  /** SystemDiagnosticsPage (admin diagnostics) copy. */
  diagnostics: {
    title: "Monitoreo del sistema",
    actions: {
      refresh: "Actualizar datos del sistema",
    },
    header: {
      lastRefreshed: "Última actualización: {{time}}",
    },
    errors: {
      healthLoadFailed: "No se pudieron cargar los datos de salud del sistema",
      diagnosticsLoadFailed: "No se pudieron cargar los datos de diagnóstico",
    },
    staleWarnings: {
      health:
        "No se pudo actualizar el estado. Se muestran los últimos datos correctos.",
      diagnostics:
        "No se pudieron actualizar los diagnósticos. Se muestran los últimos datos correctos.",
    },
    metrics: {
      cpuUsage: "Uso de CPU",
      memoryUsage: "Uso de memoria",
      dbResponseTime: "Tiempo de respuesta de la base de datos",
    },
    cards: {
      serverInfo: "Información del servidor",
      databaseStatus: "Estado de la base de datos",
      runtimeConfig: "Configuración de ejecución",
      heartbeatScanner: "Escáner de latidos",
      deadlineScanner: "Escáner de plazos",
      emailInfrastructure: "Infraestructura de correo",
      emailOutbox: "Bandeja de salida",
    },
    labels: {
      version: "Versión",
      uptime: "Tiempo activo",
      latency: "Latencia",
      redis: "Redis",
      heartbeatInterval: "Intervalo de latido",
      heartbeatTimeout: "Tiempo de espera del latido",
      deadlineScanInterval: "Intervalo de plazos",
      scanInterval: "Intervalo de escaneo",
      emailStatus: "Estado del correo",
      emailEnabled: "Activo",
      emailDisabled: "Desactivado",
      emailWorker: "Proceso",
      outboxPending: "Por enviar",
      outboxProcessing: "En proceso",
      outboxRetryWait: "En espera de reintento",
      outboxSent: "Enviado",
      outboxDead: "No se envió",
      timeout: "Tiempo agotado",
      lastScan: "Último escaneo",
      disruptedCount: "Interrumpido",
      autoSubmitCount: "Entrega automática",
      lastScanNever: "Nunca",
    },
  },

  /** Candidate exam runtime shell copy. */
  candidateRuntime: {
    status: {
      inProgress: "Respondiendo",
      ended: "El examen ya terminó",
    },
    loading: {
      attempt: "Cargando las respuestas...",
    },
    errors: {
      loadFailed:
        "No se pudieron cargar las respuestas. Revisa la conexión e inténtalo de nuevo.",
      loadUnavailable: "Las respuestas no están disponibles",
      submitFailed: "No se pudo enviar. Inténtalo de nuevo.",
      saveError:
        "Hubo un error al guardar. El sistema intentará enviar las respuestas.",
      autoSubmitFailed: "No se pudo enviar automáticamente. Elige reintentar.",
    },
    actions: {
      previous: "Pregunta anterior",
      next: "Pregunta siguiente",
      flag: "Marcar pregunta",
      unflag: "Quitar marca",
      submit: "Entregar",
      submitExam: "Entregar examen",
      retrySubmit: "Reintentar envío",
      retry: "Reintentar",
    },
    timer: {
      remaining: "Tiempo restante",
      cutoff: "Fecha límite",
      untimed: "Sin límite de tiempo",
    },
    save: {
      idle: "Sin guardar",
      saving: "Guardando...",
      saved: "Guardado",
      error: "Fallos al guardar",
    },
    navigator: {
      ariaLabel: "Navegación de preguntas",
      unanswered: "Sin responder",
      answered: "Respondida",
      flagged: "Marcada",
      questionOf: "Pregunta {{current}} de {{total}}",
      questionLabel: "Pregunta {{number}}, {{state}}",
      questionLabelCurrent: "Pregunta {{number}}, {{state}}, actual",
      questionId: "N.º",
      progress: "Respondidas: {{answered}} / sin responder: {{unanswered}}",
      progressFull:
        "Respondidas: {{answered}} / sin responder: {{unanswered}} / marcadas: {{flagged}} / total: {{total}}",
    },
    header: {
      currentExam: "Examen en curso",
      remaining: "Restante",
    },
    question: {
      number: "Pregunta {{number}}",
      score: "{{score}} puntos",
    },
    connection: {
      abnormal: "Conexión con problemas",
      restoreHint:
        "El guardado sigue cuando vuelva la conexión. No cierres la página.",
    },
    deadline: {
      passed: "Llegó la hora límite",
      passedDescription:
        "Llegó la hora límite. Ya no puedes cambiar las respuestas.",
      endedSubmitted: "Las respuestas se enviaron. El examen terminó.",
      closed: "Este examen se cerró. Ya no puedes responder.",
      autoSubmitTitle: "No se pudo enviar automáticamente",
      timeUp: "Se acabó el tiempo. El examen terminó.",
      autoSubmitting: "Enviando tus respuestas...",
      retryHint: "Usa el botón de abajo para volver a enviar.",
      endedHint: "El examen terminó. Gracias por responder.",
    },
    saveRejection: {
      title: "No se aceptó el guardado",
      defaultDescription: "El servidor rechazó este guardado.",
      staleVersion: "Hay una versión más nueva de la respuesta en el servidor.",
      futureVersion:
        "La versión de la respuesta está adelantada. Actualiza la página e inténtalo de nuevo.",
      conflictingPayload:
        "Los datos de la respuesta entran en conflicto. Actualiza la página e inténtalo de nuevo.",
      invalidAnswer:
        "La respuesta no tiene el formato que pide esta pregunta. Revísala.",
    },
    // Lock-overlay copy is branched by the authoritative snapshot lockReason
    // (#674) — each cause states only what is actually true.
    lock: {
      disruptedTitle: "Se cortó la conexión",
      disruptedDescription:
        "La respuesta está en pausa. Lo que ya se guardó no se pierde.",
      disruptedResumeHint: "Usa el botón de abajo para retomar el examen.",
      disruptedBackHint:
        "Vuelve a la lista de exámenes y elige «Continuar examen» para retomar.",
      submittedTitle: "El examen ya terminó",
      submittedDescription: "Tus respuestas ya se enviaron.",
      voidedTitle: "Examen anulado",
      voidedDescription: "Este examen fue anulado. Ya no puedes responder.",
      backToList: "Volver a los exámenes",
      viewResult: "Ver resultado",
    },
    saveRetry: {
      bannerTitle: "Algunas respuestas todavía no se guardaron",
      bannerDescription:
        "Se reintentará cuando vuelva la red. También puedes reintentar ahora.",
      retry: "Reintentar guardado",
    },
    answer: {
      panelTitle: "Respuesta",
      unsupportedType: "Tipo de pregunta no admitido: {{type}}",
      subjective: {
        label: "Respuesta abierta",
        placeholder: "Escribe la respuesta",
        charCount: "{{count}} caracteres",
        charCountWithMax: "{{count}} / {{max}}",
      },
      fillBlank: {
        blankLabel: "Espacio {{number}}",
        blankInputLabel: "Respuesta del espacio {{number}}",
        placeholder: "Escribe la respuesta",
      },
      trueFalse: {
        true: "Correcto",
        false: "Incorrecto",
      },
    },
    submitDialog: {
      title: "Confirmar entrega",
      description: "Revisa lo respondido y lo guardado.",
      totalCount: "Total de preguntas",
      flushing: "Guardando...",
      unansweredLabel: "{{count}} sin responder",
      unsavedLabel: "{{count}} sin guardar",
      saveFailedLabel: "{{count}} no se guardaron",
      saveFailedWarning:
        "Algunas respuestas no se guardaron. Puedes seguir, guardar de nuevo o enviar igual.",
      saveTimeoutWarning:
        "El guardado no se confirmó a tiempo. Reintenta o envía igual.",
      flaggedWarning: "{{count}} marcadas para revisar",
      noModify: "Después de entregar no hay cambios",
      continueAnswering: "Seguir respondiendo",
      confirmSubmit: "Confirmar entrega",
      submitting: "Enviando...",
      submitAnyway: "Enviar igual",
    },
    // REC-I3: disrupted-attempt direct restore UX (ADR-012 §Recovery Semantics).
    // Restore is an explicit command; the snapshot remains the page authority.
    restore: {
      restoringTitle: "Retomando el examen",
      restoringDescription:
        "Estamos confirmando el estado del examen y el tiempo que queda. No cierres la página.",
      failedTitle: "No se pudo retomar el examen",
      failedDescription:
        "No se pudo confirmar el estado del examen. Revisa la red e inténtalo de nuevo.",
      retryRestore: "Reintentar recuperación",
      backToList: "Volver a los exámenes",
    },
  },

  /** Candidate result / attempt detail page copy. */
  candidateResult: {
    title: "Calificación",
    loading: "Cargando la calificación...",
    error: {
      loadFailed: "No se pudo cargar la calificación",
    },
    summary: {
      passingScore: "Para aprobar: {{score}}",
      passed: "Aprobados",
      failed: "No aprobado",
    },
    detail: {
      title: "Detalle de respuestas",
    },
    table: {
      questionNumber: "N.º",
      questionContent: "Pregunta",
      questionType: "Tipo",
      yourAnswer: "Tu respuesta",
      correctAnswer: "Respuesta correcta",
      score: "Puntaje",
    },
    questionTypes: {
      single_choice: "Una opción",
      multiple_choice: "Varias opciones",
      true_false: "Verdadero o falso",
      fill_blank: "Completar espacios",
      text_response: "Texto libre",
    },
    answer: {
      unanswered: "Sin responder",
      correct: "Correcto",
      incorrect: "Incorrecto",
      manual: "Abierta",
      hidden: "—",
    },
    aria: {
      correct: "Respuesta correcta",
      incorrect: "Respuesta incorrecta",
    },
    status: {
      not_started: "El examen todavía no empieza. No hay calificación.",
      queued: "Todavía no empezaste. No hay calificación.",
      in_progress: "El examen sigue en curso. Todavía no lo entregaste.",
      submitted: "Entregado. Falta la calificación.",
      disrupted: "Se interrumpió. Vuelve a los exámenes e intenta retomar.",
      voided: "Este registro fue anulado. No se puede ver la calificación.",
      not_graded: "La calificación todavía no se puede ver. Vuelve más tarde.",
      pending_publish: "Ya está calificado, pero el resultado no se publicó.",
      default: "Ahora no se puede ver la calificación. Inténtalo más tarde.",
    },
    actions: {
      backToList: "Volver a los exámenes",
    },
  },

  /** Admin list / table page copy. */
  admin: {
    common: {
      create: "Crear",
      edit: "Editar",
      delete: "Eliminar",
      refresh: "Actualizar",
      search: "Buscar",
      view: "Ver",
      retry: "Reintentar",
      save: "Guardar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      processing: "Procesando...",
      saving: "Guardando...",
      enable: "Activar",
      disable: "Desactivar",
      confirmEnable: "Confirmar activación",
      confirmDisable: "Confirmar desactivación",
      clearSearch: "Borrar búsqueda",
      clearFilter: "Quitar filtros",
      loadFailed: "No se pudo cargar la lista de alumnos",
      saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
      deleteFailed: "No se pudo eliminar. Inténtalo de nuevo más tarde.",
      operationFailed:
        "No se pudo completar la acción. Inténtalo de nuevo más tarde.",
      noData: "No hay datos",
      loading: "Cargando…",
    },
    users: {
      title: "Gestión de usuarios",
      loadFailed: "No se pudo cargar la lista de usuarios",
      createBtn: "Nuevo usuario",
      empty: "No hay usuarios",
      emptyDescription: "Todavía no hay usuarios de gestión.",
      searchPlaceholder: "Buscar usuarios...",
      columns: {
        username: "Usuario",
        name: "Nombre",
        role: "Rol",
        status: "Estado",
        actions: "Acciones",
      },
      roleLabels: {
        Admin: "Administrador de exámenes",
        Teacher: "Docente",
        Proctor: "Supervisor",
        Grader: "Corrector",
        Candidate: "Alumno",
        Maintainer: "Operaciones del sistema",
        unknown: "Rol desconocido",
      },
      statusLabels: { active: "Activar", inactive: "Desactivar" },
      editLabel: "Editar usuario",
      enableDisable: "¿Confirmas «{{action}}» para el usuario «{{name}}»?",
      dialog: {
        create: "Nuevo usuario",
        edit: "Editar usuario",
        username: "Usuario",
        password: "Contraseña inicial",
        name: "Nombre",
        role: "Rol",
        admin: "Administrador de exámenes",
        roleLockedHint:
          "El rol actual «{{role}}» no está entre los roles que se pueden asignar. Al guardar se conserva y no cambia.",
      },
      validation: {
        nameRequired: "Ingresa tu nombre",
        usernameRequired: "Ingresa tu usuario",
        passwordMin: "La contraseña debe tener al menos {{min}} caracteres",
      },
      teacherCourses: {
        openBtn: "Comisiones a cargo",
        dialogTitle: "Comisiones de «{{name}}»",
        pickLabel: "Agregar comisión",
        pickPlaceholder: "Elegí una comisión",
        assignBtn: "Asignar",
        currentLabel: "Comisiones asignadas",
        empty: "Todavía no hay comisiones asignadas.",
        columnCourse: "Comisión",
        columnAction: "Acciones",
        revokeBtn: "Revocar",
        noChange: "Esa comisión ya está asignada",
        loadFailed:
          "No se pudieron cargar las comisiones. Inténtalo de nuevo más tarde.",
        assignFailed:
          "No se pudo asignar la comisión. Inténtalo de nuevo más tarde.",
        revokeFailed:
          "No se pudo revocar la comisión. Inténtalo de nuevo más tarde.",
        inactiveTarget:
          "Esta cuenta está desactivada. No puedes agregar asignaciones, pero sí ver y revocar las actuales.",
        optionsUnavailable:
          "La lista de comisiones no está disponible. Las asignaciones actuales siguen igual.",
        optionsEmpty: "No hay comisiones que coincidan.",
      },
      graderExams: {
        openBtn: "Exámenes a corregir",
        dialogTitle: "Exámenes a corregir de «{{name}}»",
        pickLabel: "Agregar examen",
        pickPlaceholder: "Elegir examen",
        assignBtn: "Asignar",
        currentLabel: "Exámenes asignados",
        empty: "Todavía no hay exámenes asignados.",
        revokeBtn: "Revocar",
        noChange: "Ese examen ya está en la lista",
        loadFailed:
          "No se pudieron cargar los exámenes asignados. Inténtalo de nuevo más tarde.",
        assignFailed:
          "No se pudo asignar el examen. Inténtalo de nuevo más tarde.",
        revokeFailed:
          "No se pudo revocar el examen. Inténtalo de nuevo más tarde.",
        inactiveTarget:
          "Esta cuenta está desactivada. No puedes agregar asignaciones, pero sí ver y revocar las actuales.",
        optionsUnavailable:
          "La lista de exámenes no está disponible. Las asignaciones actuales siguen igual.",
        optionsEmpty: "No hay exámenes que coincidan.",
      },
      invitations: {
        title: "Invitaciones",
        description:
          "La persona invitada crea su cuenta con el enlace del correo. El enlace sirve una sola vez.",
        inviteBtn: "Invitar",
        empty: "No hay invitaciones",
        columns: {
          email: "Correo",
          role: "Rol",
          status: "Estado",
          createdAt: "Fecha de invitación",
          expiresAt: "Válida hasta",
          actions: "Acciones",
        },
        dialogTitle: "Invitar",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "Ingresa su correo",
        emailRequired: "Ingresa el correo electrónico",
        emailInvalid: "El correo no es válido",
        roleLabel: "Rol",
        submit: "Enviar invitación",
        submitting: "Enviando...",
        acceptUrlTitle: "Enlace de invitación (se muestra una sola vez)",
        acceptUrlHint:
          "La invitación se envió por correo. Si el correo no está habilitado o el envío falló, comparte este enlace con la persona invitada.",
        copy: "Copiar enlace",
        copied: "Copiado",
        revoke: "Revocar",
        revokeTitle: "Revocar invitación",
        revokeDescription:
          "Al revocarla, el enlace deja de funcionar de inmediato y no se puede recuperar. ¿Revocar esta invitación?",
        status: {
          pending: "Pendiente",
          accepted: "Aceptada",
          revoked: "Revocada",
          expired: "Vencida",
        },
        loadFailed: "No se pudieron cargar las invitaciones",
        inviteFailed: "No se pudo enviar la invitación",
        revokeFailed: "No se pudo revocar la invitación",
      },
    },
    candidates: {
      title: "Gestión de alumnos",
      loadFailed: "No se pudo cargar la lista de alumnos",
      createBtn: "Nuevo alumno",
      importBtn: "Importar",
      empty: "No hay alumnos",
      emptyDescription: "Puedes crear alumnos con «Nuevo alumno» o «Importar».",
      searchPlaceholder: "Buscar por nombre o legajo...",
      searchLabel: "Buscar alumno",
      clearSearchLabel: "Borrar búsqueda de alumnos",
      noMatch: "Ningún alumno coincide",
      noMatchDescription: "Ningún alumno coincide con «{{q}}».",
      columns: {
        username: "Nro. de Legajo",
        name: "Nombre",
        status: "Estado",
        actions: "Acciones",
      },
      statusLabels: { active: "Activar", inactive: "Desactivar" },
      editLabel: "Editar alumno",
      resetPassword: "Restablecer contraseña",
      enableDisable: "¿Confirmas «{{action}}» para el alumno «{{name}}»?",
      dialog: {
        create: "Nuevo alumno",
        edit: "Editar alumno",
        resetTitle: "Restablecer contraseña",
        username: "Nro. de Legajo",
        password: "Contraseña inicial",
        name: "Nombre",
        newPassword: "Contraseña nueva",
        confirmNewPassword: "Vuelve a ingresar la contraseña",
        resetDescription:
          "Se restablecerá la contraseña del alumno «{{name}}».",
        resetting: "Restableciendo...",
        confirmReset: "Restablecer",
      },
      validation: {
        nameRequired: "Ingresa tu nombre",
        usernameRequired: "Ingresa tu usuario",
        passwordMin: "La contraseña debe tener al menos {{min}} caracteres",
        fieldRequired: "Este campo es obligatorio",
        passwordMismatch: "Las contraseñas no coinciden",
        passwordRange:
          "La contraseña debe tener entre {{min}} y {{max}} caracteres",
      },
      toast: {
        updated: "Alumno actualizado",
        created: "Alumno creado",
        passwordReset: "Contraseña restablecida",
        resetFailed:
          "No se pudo restablecer la contraseña. Inténtalo de nuevo más tarde.",
      },
      importDialog: {
        title: "Importar alumnos",
        instructions:
          "Pega el contenido CSV. El encabezado debe incluir username, password, name y los campos de identidad configurados.",
        truncated:
          "Se tomaron solo las primeras {{max}} filas. El resto se ignoró.",
        missingField: "{{label}} no puede estar vacío",
        missingUsername: "Falta el legajo o el nombre",
        needPassword: "Un alumno nuevo necesita contraseña inicial",
        passwordMin:
          "La contraseña inicial debe tener al menos {{min}} caracteres",
        exists: "Ya existe. Importarlo de nuevo reemplaza sus datos.",
        duplicateInBatch:
          "Legajo repetido en este lote; reemplaza la fila anterior",
        willCreate: "Se creará el alumno",
        result:
          "Importación terminada: {{created}} creados, {{updated}} actualizados, {{errors}} con error",
        failed: "No se pudo importar. Inténtalo de nuevo.",
      },
    },
    courses: {
      title: "Gestión de comisiones",
      loadFailed: "No se pudo cargar la lista de comisiones",
      createBtn: "Nueva comisión",
      empty: "No hay comisiones",
      emptyDescription:
        "Todavía no hay comisiones. Crea una con el botón de arriba.",
      noMatch: "Ninguna comisión coincide",
      noMatchDescription: "Ninguna comisión coincide con «{{q}}».",
      searchPlaceholder: "Buscar comisión por nombre...",
      searchLabel: "Buscar comisiones",
      clearSearchLabel: "Borrar búsqueda de comisiones",
      columns: {
        name: "Nombre",
        code: "Código",
        subject: "Materia",
        description: "Descripción",
        actions: "Acciones",
      },
      editLabel: "Editar comisión",
      deleteLabel: "Eliminar comisión",
      enableDisable: "¿Confirmas «{{action}}» para la comisión «{{name}}»?",
      dialog: {
        create: "Nueva comisión",
        edit: "Editar comisión",
        name: "Nombre",
        code: "Código",
        subject: "Materia",
        namePlaceholder: "Ingresa el nombre de la comisión",
        codePlaceholder: "Ingresa el código de la comisión",
        subjectPlaceholder: "Elegí una materia",
      },
      validation: {
        nameRequired: "Ingresa el nombre de la comisión",
        codeRequired: "Ingresa el código de la comisión",
        subjectRequired: "Elegí la materia",
        nameTaken: "Ya existe una comisión con ese nombre",
      },
      toast: {
        updated: "Comisión actualizada",
        created: "Comisión creada",
        deleted: "Comisión eliminada",
      },
    },
    exams: {
      title: "Gestión de exámenes",
      loadFailed: "No se pudo cargar la lista de exámenes",
      createBtn: "Crear examen",
      empty: "No hay exámenes",
      emptyDescription:
        "Todavía no hay exámenes. Crea uno con el botón de arriba.",
      noMatch: "Ningún examen coincide con el filtro",
      noMatchDescription:
        "No hay exámenes con este estado. Limpia el filtro para verlos todos.",
      statusFilterLabel: "Filtrar por estado",
      statusAll: "Todos los estados",
      clearFilterLabel: "Quitar filtro de estado",
      toolbarLabel: "Barra de la lista de exámenes",
      listTitle: "Lista de exámenes",
      listDescription:
        "Estado, ventana horaria y configuración básica de cada examen.",
      columns: {
        title: "Nombre del examen",
        status: "Estado",
        timeWindow: "Ventana horaria",
        duration: "Duración",
        questionCount: "Preguntas",
        participants: "Participantes",
        passingScore: "Puntaje para aprobar",
        actions: "Acciones",
      },
      deleteLabel: "Eliminar examen",
      viewDetail: "Ver detalle",
      confirmDelete: "Confirmar eliminación",
      confirmDeleteDescription:
        "¿Seguro que quieres eliminar el examen «{{title}}»?",
      deleteDisabled: "No se puede eliminar ahora",
      /** Machine DisabledReasonCode presentation (D0.8, C3). The legacy
       * natural-language wire fields stay compatibility-only fallbacks for
       * unknown future codes. */
      disabledReasons: {
        canceled: "Examen cancelado",
        notFinished: "El examen todavía no terminó",
        noGradedAttempts: "Todavía no hay entregas corregidas",
        notDraft: "Solo se pueden eliminar exámenes en borrador",
      },
      duration: "{{min}} minutos",
      toast: {
        deleted: "Examen eliminado",
        deleteFailed: "No se pudo eliminar. Inténtalo de nuevo más tarde.",
      },
    },
    questions: {
      title: "Gestión de preguntas",
      importBtn: "Importar preguntas",
      createBtn: "Nueva pregunta",
      empty: "No hay preguntas",
      emptyDescription:
        "Todavía no hay preguntas. Crea una con el botón de arriba.",
      noMatch: "Ninguna pregunta coincide",
      noMatchDescription:
        "Ninguna pregunta coincide con el filtro o la búsqueda.",
      searchPlaceholder: "Buscar en el enunciado...",
      searchLabel: "Buscar preguntas",
      filterToolbar: "Filtros de preguntas",
      filterCourse: "Filtrar por comisión",
      filterAllCourses: "Todas las comisiones",
      filterType: "Filtrar por tipo",
      filterAllTypes: "Todos los tipos",
      filterDifficulty: "Filtrar por dificultad",
      filterAllDifficulties: "Todas las dificultades",
      difficultyLabel: "Dificultad {{value}}",
      tagFilterLabel: "Filtro de etiquetas",
      tagFilterPlaceholder: "Etiquetas",
      tagFilterSearchLabel: "Buscar etiquetas",
      tagFilterSearchPlaceholder: "Buscar etiquetas...",
      tagFilterEmpty: "Ninguna etiqueta coincide",
      tagFilterAndHint: "Si eliges varias, la pregunta debe incluir todas",
      tagFilterClear: "Quitar selección",
      clearFilter: "Quitar filtros",
      columns: {
        type: "Tipo",
        content: "Enunciado",
        course: "Comisión",
        score: "Puntos",
        difficulty: "Dificultad",
        tags: "Etiquetas",
        actions: "Acciones",
      },
      questionTypes: {
        single_choice: "Una opción",
        multiple_choice: "Varias opciones",
        fill_blank: "Completar espacios",
        true_false: "Verdadero o falso",
        text_response: "Texto libre",
      },
      editLabel: "Editar pregunta",
      deleteLabel: "Eliminar pregunta",
      confirmDelete: "Confirmar eliminación",
      confirmDeleteDescription: "¿Seguro que quieres eliminar esta pregunta?",
      toast: {
        deleteFailed: "No se pudo eliminar la pregunta. Inténtalo de nuevo.",
      },
    },
    audit: {
      title: "Registro de auditoría",
      description: "Acciones registradas en el sistema",
      empty: "No hay registros de auditoría",
      emptyDescription: "Las acciones del sistema se registran aquí",
      loadFailed: "No se pudo cargar el registro de auditoría",
      ipAddress: "IP: {{address}}",
      clearFilter: "Quitar filtros",
      startDate: "Fecha de inicio",
      endDate: "Fecha de fin",
      export: "Exportar CSV",
      exporting: "Exportando…",
      exportFailed: "No se pudo exportar",
      pageInfo: "{{count}} en esta página",
      columns: {
        time: "Fecha",
        actor: "Autor",
        action: "Acciones",
        target: "Objeto",
        detail: "Detalle",
      },
      filterActions: {
        all: "Todas las acciones",
        "exam.create": "Crear examen",
        "exam.update": "Actualizar examen",
        "exam.publish": "Publicar examen",
        "exam.open": "Abrir examen",
        "exam.close": "Cerrar examen",
        "exam.closed": "Cerrar examen (automático)",
        "exam.unpublish": "Despublicar",
        "exam.extend": "Extender el tiempo",
        "exam.cancel": "Cancelar examen",
        "exam.archive": "Archivar examen",
        "exam.publish_results": "Publicar resultados",
        "exam.delete": "Eliminar examen",
        // Security-sensitive schedule update on an already published exam.
        "exam.published_schedule_updated": "Actualizar examen publicado",
        "attempt.start": "Empezó a responder",
        "attempt.restore": "Reanudar respuestas",
        "attempt.saveAnswer": "Guardó la respuesta",
        "attempt.submit": "Entregó el examen",
        "attempt.autoSubmit": "Entrega automática",
        "attempt.disrupted": "Interrupción al responder",
        "attempt.misconductFlagged": "Marcar irregularidad",
        "attempt.forceSubmit": "Forzar entrega",
        "attempt.extendTime": "Extender el tiempo",
        "attempt.timeGrant": "Se otorgó tiempo de examen",
        "attempt.exported": "Exportar entrega",
        "grading.score_entered": "Registrar puntaje",
        "grading.finalized": "Corrección terminada",
        "candidate.create": "Crear alumno",
        "candidate.update": "Actualizar alumno",
        "candidate.import": "Importar alumnos",
        "candidate.password_reset": "Restablecer contraseña del alumno",
        "candidate_field.create": "Crear campo del alumno",
        "candidate_field.update": "Actualizar campo del alumno",
        "candidate_field.delete": "Eliminar campo del alumno",
        "question.create": "Crear pregunta",
        "question.update": "Actualizar pregunta",
        "question.delete": "Eliminar pregunta",
        "question.import": "Importar preguntas",
        "course.create": "Crear comisión",
        "course.update": "Actualizar comisión",
        "course.delete": "Eliminar comisión",
        "enrollment.add": "Agregar inscripción",
        "enrollment.remove": "Quitar inscripción",
        "user.create": "Crear usuario",
        "user.update": "Actualizar usuario",
        "user.delete": "Eliminar usuario",
        "login.success": "Inicio de sesión correcto",
        "login.failure": "No se pudo iniciar sesión",
        logout: "Cerrar sesión",
        export_scores: "Exportar resultados",
        "branding.update": "Actualizar la marca",
        "admin.bootstrap": "Alta inicial del administrador",
        "admin.password_reset.local": "Restablecer contraseña local",
        // Identity lifecycle actions.
        "user.invited": "Invitar usuario",
        "user.invitation_revoked": "Revocar invitación",
        "user.invitation_accepted": "Aceptar invitación",
        "user.disabled": "Desactivar usuario",
        "user.reactivated": "Reactivar usuario",
        "user.role_changed": "Cambio de rol",
        "user.profile_updated": "Actualizar datos del usuario",
        "auth.password_reset_requested": "Pedir restablecimiento de contraseña",
        "auth.password_reset_request_rejected":
          "Rechazar restablecimiento de contraseña",
        "auth.password_reset": "Restablecer contraseña",
        "auth.profile_update": "Actualizar perfil",
        "auth.password_update": "Cambiar contraseña",
        // Audit export action.
        "audit_log.exported": "Exportar registro de auditoría",
        // Assignment lifecycle (ADR-015).
        "exam.proctor_assigned": "Asignar supervisor",
        "exam.proctor_revoked": "Revocar supervisor",
        "course.teacher_assigned": "Asignar docente a la comisión",
        "course.teacher_revoked": "Revocar docente de la comisión",
        "exam.grader_assigned": "Asignar corrector",
        "exam.grader_revoked": "Revocar corrector",
        // Grading / score.
        "grading.detail_viewed": "Ver detalle de la calificación",
        // Exam policy profiles.
        "exam_profile.create": "Crear plantilla de política",
        "exam_profile.update": "Actualizar plantilla de política",
        "exam_profile.delete": "Eliminar plantilla de política",
        // Incidents (ADR-014).
        "proctor.incident_marked": "Marcar incidente",
        "incident.created": "Crear incidente",
        "incident.investigated": "Investigar incidente",
        "incident.note_added": "Agregar nota al incidente",
        "incident.severity_changed": "Cambiar gravedad del incidente",
        "incident.resolved": "Resolver incidente",
        "incident.dismissed": "Descartar incidente",
        "incident.action_linked": "Vincular acción",
        "incident.attempt_linked": "Vincular entrega",
        "incident.interruption_linked": "Vincular interrupción",
        // System operations.
        "ops.policy.updated": "Actualizar política de operaciones",
        "system.email.test": "Enviar correo de prueba",
        // Email outbox worker actions (lifecycle: reserved — vocabulary
        // declared with no production emitter).
        "email.outbox_created": "Crear registro de envío",
        "email.send_failed": "Falló el envío del correo",
        "email.send_retried": "Reintentar envío del correo",
      },
      filterTargets: {
        all: "Todos los objetos",
        attempt: "Entrega",
        exam: "Exámenes",
        user: "Usuario",
        enrollment: "Inscripción",
        organization: "Organización",
      },
    },
    permissions: {
      title: "Registro de permisos",
      description:
        "Catálogo de permisos, roles predefinidos y capacidades que da el rol de cada usuario",
      loadFailed: "No se pudo cargar el registro de permisos",
      loadAuthorityFailed: "No se pudieron cargar las capacidades del usuario",
      catalog: {
        title: "Catálogo de permisos",
        description:
          "Todos los permisos del sistema, agrupados por área. La clave del permiso es el identificador de referencia.",
      },
      categories: {
        user: "Usuarios y organización",
        candidate: "Gestión de alumnos",
        course: "Comisión",
        question: "Pregunta",
        exam: "Ciclo del examen",
        attempt_runtime: "Respuestas del alumno",
        proctor: "Supervisión",
        grading: "Calificación",
        score: "Resultados",
        system: "Sistema y operaciones",
        incident: "Incidentes",
        assignment: "Asignaciones",
      },
      roles: {
        title: "Matriz de roles",
        description:
          "Permisos de cada rol predefinido (los permisos sensibles salen de sensitivePermissions de ese rol)",
        columnPermission: "Permiso",
        granted: "Otorgado",
        role: {
          Admin: "Administrador",
          Teacher: "Docente",
          Proctor: "Supervisión",
          Grader: "Corrector",
          Candidate: "Alumno",
          Maintainer: "Operaciones",
          System: "Sistema",
        },
      },
      effective: {
        title: "Capacidades del usuario",
        description:
          "Elige un usuario del personal para ver las capacidades de sus roles. Esas capacidades habilitan; no autorizan cada recurso por separado.",
        userSelect: "Elegir usuario del personal",
        noActive: "Sin asignación vigente",
        capabilities: "Capacidades otorgadas",
        assignments: "Roles asignados",
        scopeNote:
          "Junta las capacidades de los roles activos. Esa unión habilita, pero no dice qué asignación corresponde a cada capacidad. Qué se puede abrir en cada recurso lo limita el scope assignment de la comisión, el examen u otros.",
        primary: "Rol principal",
        inactive: "Desactivado",
        reason: "Motivo: {{reason}}",
      },
    },
    grading: {
      title: "Por calificar",
      description: "Exámenes que hay que calificar a mano",
      empty: "No hay exámenes por calificar",
      emptyDescription: "Ahora no hay exámenes para calificar a mano",
      loadFailed: "No se pudo cargar la cola de calificación",
      columns: {
        candidate: "Alumno",
        exam: "Exámenes",
        submittedAt: "Fecha de entrega",
        pendingCount: "Preguntas por calificar",
        status: "Estado",
      },
    },
    candidateFields: {
      title: "Campos del alumno",
      downloadTemplate: "Descargar plantilla",
      addField: "Agregar campo",
      empty: "No hay campos de alumno",
      emptyDescription:
        "Primero configura el identificador único y los datos que hay que pedir.",
      loadFailed: "No se pudo cargar la configuración de campos",
      templateFilename: "plantilla-importacion-alumnos.csv",
      columns: {
        fieldName: "Nombre del campo",
        label: "Etiquetas",
        type: "Tipo",
        required: "Obligatorio",
        unique: "Único",
        sortOrder: "Orden",
        actions: "Acciones",
      },
      typeLabels: { text: "Texto", number: "Número", select: "Opciones" },
      requiredLabels: { true: "Sí", false: "No" },
      moveUp: "Subir",
      moveDown: "Bajar",
      editLabel: "Editar campo",
      deleteLabel: "Eliminar campo",
      confirmDelete: "Confirmar eliminación",
      confirmDeleteDescription:
        "¿Seguro que quieres eliminar el campo «{{label}}»?",
      dialog: {
        create: "Agregar campo",
        edit: "Editar campo",
        fieldName: "Nombre del campo",
        label: "Etiquetas",
        type: "Tipo",
        typeNote: "(no se puede cambiar después de crearlo)",
        fieldTypeLabel: "Tipo de campo",
        required: "Obligatorio",
        uniqueIdentity: "Identificador único",
      },
      toast: {
        saveFailed:
          "No se pudo guardar el campo. Inténtalo de nuevo más tarde.",
        deleteFailed:
          "No se pudo eliminar el campo. Inténtalo de nuevo más tarde.",
        sortFailed:
          "No se pudo cambiar el orden. Inténtalo de nuevo más tarde.",
      },
    },
    examCreate: {
      pageTitle: "Crear examen",
      selectedQuestions: "Preguntas elegidas ({{count}})",
      selectQuestions: "Elegir preguntas",
      noQuestionsTitle: "Ninguna pregunta elegida",
      noQuestionsDescription:
        "Hacé clic en «Elegir preguntas» para seleccionarlas.",
      tableHeaders: {
        type: "Tipo",
        content: "Enunciado",
        score: "Puntos",
        actions: "",
      },
      dialogTitle: "Elegir preguntas",
      dialogActions: {
        add: "Agregar",
        close: "Cerrar",
      },
      ariaDeleteQuestion: "Eliminar pregunta",
      validation: {
        titleRequired: "Ingresá el nombre del examen",
        courseRequired: "Elegí una comisión",
        timeInvalid: "La hora de fin tiene que ser posterior al inicio",
        scoreInvalid: "El puntaje para aprobar no puede superar el total",
      },
      feedback: {
        fixErrors: "Corrige los errores del formulario",
        publishSuccess: "El examen se creó y se publicó",
        draftSuccess: "El examen quedó guardado como borrador",
        saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
        loadDataFailed: "No se pudieron cargar los datos",
      },
      actions: {
        cancel: "Cancelar",
        saving: "Guardando...",
        saveDraft: "Guardar borrador",
        publishing: "Publicando...",
        publish: "Publicar examen",
      },
    },
    examPreview: {
      banner:
        "Vista previa. Así ve el examen un alumno. Las respuestas no se guardan.",
      duration: "Duración: {{minutes}} min",
      close: "Cerrar",
      submitDisabled: "En la vista previa no se puede entregar el examen.",
      empty: "El examen todavía no tiene preguntas.",
      errors: {
        loadFailed: "No se pudo cargar la vista previa del examen",
      },
    },
    examQuestionsEditor: {
      selectedCount: "Preguntas elegidas ({{count}})",
      persistHint:
        "Los cambios en la lista de preguntas se guardan al guardar el examen.",
      noQuestionsTitle: "Ninguna pregunta elegida",
      noQuestionsDescription: "Creá una pregunta nueva o agregá una del banco.",
      listLabel: "Preguntas del examen",
      questionNumber: "Pregunta {{n}}",
      missingQuestion: "Pregunta no encontrada en el banco",
      scoreLabel: "Puntos",
      scoreReadOnly: "{{score}} puntos",
      newQuestion: "Nueva pregunta",
      newQuestionTitle: "Pregunta nueva",
      addFromBank: "Agregar del banco",
      edit: "Editar pregunta",
      moveUp: "Subir pregunta",
      moveDown: "Bajar pregunta",
      removeFromExam: "Quitar del examen",
      dragHandle: "Reordenar pregunta",
      saveQuestion: "Guardar pregunta",
      saving: "Guardando…",
      cancel: "Cancelar",
      loadFailed: "No se pudo cargar la pregunta",
      saveFailed: "No se pudo guardar la pregunta",
      bankDialogTitle: "Elegir preguntas del banco",
      tableHeaders: {
        type: "Tipo",
        content: "Enunciado",
        actions: "",
      },
      dialogActions: { add: "Agregar", close: "Cerrar" },
      confirmRemoveTitle: "Quitar pregunta",
      confirmRemoveDescription:
        "¿Querés quitar esta pregunta del examen? Después la podés volver a agregar.",
      confirmRemoveAction: "Quitar",
      sharedSaveTitle: "¿Cómo querés guardar los cambios?",
      sharedSaveDescription:
        "Esta pregunta está en el banco y puede estar en otros exámenes. Si la reemplazás, cambia en todos los exámenes en borrador que la usan; los publicados no cambian.",
      replaceInBank: "Reemplazar en el banco",
      saveAsCopy: "Guardar como copia",
    },
    examEdit: {
      pageTitle: "Editar examen",
      publishedAlert:
        "Este examen ya está publicado. Solo puedes cambiar la hora de inicio y la de cierre.",
      selectedQuestions: "Preguntas elegidas ({{count}})",
      selectQuestions: "Elegir preguntas",
      noQuestionsTitle: "Ninguna pregunta elegida",
      noQuestionsDescription:
        "Hacé clic en «Elegir preguntas» para seleccionarlas.",
      tableHeaders: {
        type: "Tipo",
        content: "Enunciado",
        score: "Puntos",
        actions: "",
      },
      dialogTitle: "Elegir preguntas",
      dialogActions: {
        add: "Agregar",
        close: "Cerrar",
      },
      ariaDeleteQuestion: "Eliminar pregunta",
      confirmRemoveTitle: "Quitar pregunta",
      confirmRemoveDescription:
        "¿Querés quitar esta pregunta del examen? Después la podés volver a agregar.",
      validation: {
        titleRequired: "Ingresá el nombre del examen",
        courseRequired: "Elegí una comisión",
        timeInvalid: "La hora de fin tiene que ser posterior al inicio",
        scoreInvalid: "El puntaje para aprobar no puede superar el total",
      },
      feedback: {
        fixErrors: "Corrige los errores del formulario",
        updateSuccess: "Examen actualizado",
        saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
        loadDataFailed: "No se pudo cargar el examen",
        loadConfigFailed:
          "Los datos del examen no cargaron bien. Intentá de nuevo.",
      },
      actions: {
        cancel: "Cancelar",
        saving: "Guardando...",
        save: "Guardar",
      },
    },
    examProfilePages: {
      listPageTitle: "Plantillas de reglas",
      listPageDescription:
        "Plantillas reutilizables para el examen. Al crear un examen puedes elegir una y completar la política.",
      createBtn: "Nueva plantilla",
      fromStarterBtn: "Crear desde una plantilla base",
      newProfilePageTitle: "Nueva plantilla de reglas",
      editProfilePageTitle: "Editar plantilla de reglas",
      columns: {
        name: "Nombre de la plantilla",
        summary: "Resumen",
        updatedAt: "Actualización",
        actions: "",
      },
      emptyTitle: "No hay plantillas de política",
      emptyDescription:
        "Con una plantilla puedes completar la política al crear un examen.",
      deleteConfirmTitle: "Eliminar plantilla de política",
      deleteConfirmDescription:
        "Eliminar esta plantilla no cambia los exámenes ya creados con ella. Su configuración queda igual.",
      deleteConfirmAction: "Confirmar eliminación",
      sections: {
        basic: "Datos de la plantilla",
        duration: "Duración del examen",
        entrySubmit: "Límites de ingreso y entrega",
        retake: "Volver a rendir",
        scoring: "Cálculo y publicación de resultados",
        interruption: "Interrupción y reanudación",
      },
      fields: {
        name: "Nombre de la plantilla",
        namePlaceholder: "Por ejemplo: Examen en línea estándar",
        description: "Descripción de la plantilla",
        descriptionPlaceholder:
          "Opcional. Ayuda a entender cuándo conviene usar esta plantilla.",
        durationMinutes: "Duración (minutos)",
        latestStartOffsetMinutes: "Ingreso más tarde (minutos desde el inicio)",
        minSubmitAfterStartMinutes:
          "Mínimo para entregar (minutos desde el inicio)",
        noLimitPlaceholder: "Vacío = sin límite",
        retakePolicy: "Volver a rendir",
        maxAttempts: "Tope de intentos",
        scoreStrategy: "Qué puntaje cuenta",
        resultPublicationMode: "Cuándo se publican",
        interruptionTimePolicy: "Si se corta la conexión",
        interruptionGracePerIncidentSeconds:
          "Tope de gracia por corte (segundos)",
        interruptionGracePerAttemptSeconds:
          "Tope de gracia acumulado (segundos)",
      },
      enumLabels: {
        retakePolicyUnlimited: "Sin tope",
        retakePolicyMaxAttempts: "Con tope",
        retakePolicyPassThenStop: "Hasta aprobar",
        scoreStrategyHighest: "El más alto",
        scoreStrategyLatest: "El último",
        scoreStrategyFirst: "El primero",
        resultPublicationImmediate: "Al entregar",
        resultPublicationAfterGrading: "Al corregir",
        resultPublicationManual: "Cuando un administrador las publique",
        interruptionStrict: "Sin tiempo de gracia",
        interruptionBoundedGrace: "Tiempo de gracia limitado",
        interruptionOperatorIncident: "Lo resuelve una persona",
      },
      interruptionHint:
        "«Tiempo extra limitado» compensa parte del tiempo si se corta la conexión. «Sin tiempo extra» calcula el cierre desde el inicio, sin compensar.",
      summaryDuration: "{{count}} minutos",
      summaryNoDuration: "Sin duración individual",
      summaryLatestStart: "Último ingreso: {{count}} minutos",
      summaryMinSubmit: "Entrega mínima: {{count}} minutos",
      summaryMaxAttempts: "Hasta {{count}} intentos",
      starterDialogTitle: "Crear desde una plantilla base",
      starterDialogDescription:
        "Elige una plantilla base para completar los campos. Después puedes cambiarlos.",
      starterUse: "Usar esta plantilla",
      starterCancel: "Cancelar",
      feedback: {
        loadFailed: "No se pudieron cargar las plantillas de política",
        loadOneFailed: "No se pudo cargar la plantilla",
        createSuccess: "Plantilla de política creada",
        updateSuccess: "Plantilla de política actualizada",
        deleteSuccess: "Plantilla de política eliminada",
        saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
        duplicateName: "Ya existe una plantilla de política con ese nombre",
        nameRequired: "Ingresa el nombre de la plantilla",
        durationRequired: "Ingresá la duración del examen",
        graceCapRequired: "Ingresa el tope de tiempo extra (entero positivo)",
        graceCapOrder:
          "El tope por interrupción no puede ser mayor que el tope acumulado",
      },
      actions: {
        cancel: "Cancelar",
        saving: "Guardando...",
        save: "Guardar",
        edit: "Editar",
        delete: "Eliminar",
      },
    },
    starterProfiles: {
      basicQuiz: {
        name: "Prueba básica",
        description:
          "Un solo intento, el resultado sale al entregar y el tiempo es estricto. Sirve para una prueba breve o inicial.",
      },
      standardOnline: {
        name: "Examen en línea estándar",
        description:
          "Permite varios intentos y se queda con el puntaje más alto. Los resultados se publican al terminar la corrección y, si se corta la conexión, hay tiempo extra limitado. Sirve para un examen en línea habitual.",
      },
    },
    examWizard: {
      pageTitle: "Crear examen",
      pageDescription:
        "Crea el examen por pasos. Puedes elegir una plantilla de política para completar los campos.",
      steps: {
        basic: "Datos básicos",
        basicDesc: "Nombre, comisión y plantilla de política",
        policy: "Política del examen",
        policyDesc: "Duración, reintentos, resultados e interrupciones",
        questions: "Preguntas y puntaje",
        questionsDesc: "Elige las preguntas y define el puntaje",
        schedule: "Horario",
        scheduleDesc: "Apertura y cierre",
        review: "Revisar y crear",
        reviewDesc: "Revisa los datos y crea el borrador",
      },
      stepperLabel: "Pasos para crear",
      stepOf: "Paso {{current}} de {{total}}",
      prev: "Anterior",
      next: "Siguiente",
      copyOnApplyHint:
        "Al elegir una plantilla, sus ajustes se copian a este examen. Cambiar la plantilla después no modifica este examen.",
      profileSource: {
        none: "Sin plantilla",
        existingProfile: "Usar plantilla existente",
        fromValue: "Desde «{{name}}»",
        customized: "Con cambios",
      },
      resetToProfile: "Volver a la plantilla",
      clearOverride: "Quitar cambios",
      noProfileHint:
        "Se usarán los valores predeterminados. Puedes cambiar cada campo en el paso «Política del examen».",
      policySectionBasic: "Datos básicos",
      policySectionQuestions: "Preguntas y puntaje",
      policySectionSchedule: "Horario",
      sections: {
        duration: "Duración del examen",
        entrySubmit: "Límites de ingreso y entrega",
        retakeScoring: "Reintentos y resultados",
        interruption: "Interrupción y reanudación",
      },
      fields: {
        title: "Nombre del examen",
        titlePlaceholder: "Ingresá el nombre del examen",
        description: "Indicaciones",
        descriptionPlaceholder: "Opcional",
        course: "Comisión",
        coursePlaceholder: "Elegí una comisión",
        durationMinutes: "Duración (minutos)",
        latestStartOffsetMinutes: "Ingreso más tarde (minutos desde el inicio)",
        minSubmitAfterStartMinutes:
          "Mínimo para entregar (minutos desde el inicio)",
        noLimitPlaceholder: "Vacío = sin límite",
        retakePolicy: "Volver a rendir",
        maxAttempts: "Tope de intentos",
        scoreStrategy: "Qué puntaje cuenta",
        resultPublicationMode: "Cuándo se publican",
        interruptionTimePolicy: "Si se corta la conexión",
        interruptionGracePerIncidentSeconds:
          "Tope de gracia por corte (segundos)",
        interruptionGracePerAttemptSeconds:
          "Tope de gracia acumulado (segundos)",
      },
      enumLabels: {
        retakePolicyUnlimited: "Sin tope",
        retakePolicyMaxAttempts: "Con tope",
        retakePolicyPassThenStop: "Hasta aprobar",
        scoreStrategyHighest: "El más alto",
        scoreStrategyLatest: "El último",
        scoreStrategyFirst: "El primero",
        resultPublicationImmediate: "Al entregar",
        resultPublicationAfterGrading: "Al corregir",
        resultPublicationManual: "Cuando un administrador las publique",
        interruptionStrict: "Sin tiempo de gracia",
        interruptionBoundedGrace: "Tiempo de gracia limitado",
        interruptionOperatorIncident: "Lo resuelve una persona",
      },
      questions: {
        selectedCount: "Preguntas elegidas ({{count}})",
        selectQuestions: "Elegir preguntas",
        noQuestionsTitle: "Ninguna pregunta elegida",
        noQuestionsDescription:
          "Hacé clic en «Elegir preguntas» para seleccionarlas.",
        tableHeaders: {
          type: "Tipo",
          content: "Enunciado",
          score: "Puntos",
          actions: "",
        },
        dialogTitle: "Elegir preguntas",
        dialogActions: { add: "Agregar", close: "Cerrar" },
        ariaDeleteQuestion: "Eliminar pregunta",
        confirmRemoveTitle: "Quitar pregunta",
        confirmRemoveDescription:
          "¿Querés quitar esta pregunta del examen? Después la podés volver a agregar.",
        totalScore: "Puntaje total",
        autoCalc: "Cálculo automático",
        manualInput: "Carga manual",
        autoCalcLabel: "Cálculo automático: {{score}} puntos",
        passingScore: "Puntaje para aprobar",
        scoreMismatch:
          "El puntaje total no coincide con la suma de las preguntas (tiene que ser {{score}})",
        passingScoreExceeds:
          "El puntaje para aprobar no puede superar el total ({{passing}} > {{total}})",
      },
      schedule: {
        startTime: "Inicio",
        untimedHint:
          "Este examen no tiene límite de tiempo: se puede responder cuando sea, sin fecha límite.",
        endTime: "Fin",
        timeInvalid: "La hora de fin tiene que ser posterior al inicio",
      },
      review: {
        title: "Revisar antes de crear",
        summaryHeading: "Política resultante",
        basicHeading: "Datos básicos",
        scheduleHeading: "Horario",
        scoringHeading: "Puntaje",
        questionsHeading: "Pregunta",
        policyHeading: "Política",
        warningsHeading: "Avisos",
        noQuestionsWarning:
          "No hay preguntas elegidas. Se va a crear un borrador sin preguntas.",
        scoreMismatchWarning:
          "El puntaje total no coincide con la suma de las preguntas (tiene que ser {{score}}).",
      },
      validation: {
        titleRequired: "Ingresá el nombre del examen",
        courseRequired: "Elegí una comisión",
        timeRequired: "Indicá el inicio y el fin",
        timeInvalid: "La hora de fin tiene que ser posterior al inicio",
        durationRequired: "Ingresá la duración del examen",
        maxAttemptsInvalid: "El tope de intentos tiene que ser 1 o más",
        scoreInvalid: "El puntaje para aprobar no puede superar el total",
      },
      feedback: {
        fixErrors: "Corregí los errores de este paso",
        createSuccess: "Borrador del examen creado",
        createFailed: "No se pudo crear. Intentá de nuevo más tarde.",
        loadDataFailed: "No se pudieron cargar los datos",
      },
      actions: {
        cancel: "Cancelar",
        creating: "Creando...",
        createDraft: "Crear borrador",
      },
    },
    examMonitoring: {
      pageTitle: "Monitoreo del examen",
      loadingLabel: "Cargando el monitoreo...",
      loadDataFailed: "No se pudo cargar el monitoreo",
      pollFailed:
        "No se pudo actualizar. Se muestran los datos de la última carga que salió bien.",
      timelineLoadFailed: "No se pudo cargar la línea de tiempo de eventos",
      lastRefreshed: "Última actualización: {{time}}",
      ariaRefresh: "Actualizar monitoreo",
      emptyTitle: "No hay alumnos activos",
      emptyDescription: "Ahora no hay alumnos rindiendo",
      columns: {
        candidate: "Alumno",
        status: "Estado del examen",
        online: "Conexión",
        lastHeartbeat: "Última señal",
        lastSave: "Último guardado",
        visibilityLost: "Pestaña oculta",
        browserOffline: "Sin red",
        saveFailed: "Fallos al guardar",
        submitFailed: "Fallos al enviar",
        warningLevel: "Alerta",
        actions: "Acciones",
      },
      onlineLabels: {
        online: "En línea",
        stale: "Demorado",
        offline: "Desconectado",
      },
      warningLabels: {
        normal: "Normal",
        warning: "Atención",
        critical: "Urgente",
      },
      statusLabels: {
        in_progress: "Rindiendo",
        disrupted: "Interrumpido",
        submitted: "Entregado",
        graded: "Calificado",
        voided: "Anulado",
      },
      timeline: {
        title: "Línea de tiempo — {{name}}",
        button: "Línea de tiempo",
        noEvents: "No hay incidentes",
        auditLog: "Acciones",
        frontend: "Navegador",
      },
    },
    questionEdit: {
      newTitle: "Nueva pregunta",
      editTitle: "Editar pregunta",
      loadDataFailed: "No se pudieron cargar los datos",
      saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
      rubricRequired: "El criterio de corrección no puede estar vacío",
      fillBlankPlaceholder:
        "El enunciado de completar espacios tiene que incluir ____",
      actions: {
        cancel: "Cancelar",
        saving: "Guardando...",
        save: "Guardar",
      },
    },
    settings: {
      pageTitle: "Plataforma e institución",
      profileSection: {
        title: "Datos personales",
        description: "Editá el nombre que se muestra en esta cuenta.",
        nameLabel: "Nombre",
        validation: {
          nameRequired: "Ingresa tu nombre",
        },
        feedback: {
          updateSuccess: "Datos personales actualizados",
          saveFailed: "No se pudo guardar. Intentá de nuevo más tarde.",
        },
      },
      brandSection: {
        title: "Marca",
        description: "Nombre y pie que se muestran en esta instalación.",
        saveFailed:
          "No se pudo guardar la configuración. Intentá de nuevo más tarde.",
      },
      securitySection: {
        title: "Seguridad de la cuenta",
        description: "Cambiá la contraseña de esta cuenta.",
      },
      loadDataFailed: "No se pudo cargar la configuración",
      loginRequired: "Tenés que iniciar sesión",
      actions: {
        saving: "Guardando...",
        save: "Guardar",
      },
    },
    platformSettings: {
      productName: "Título del producto",
      productNamePlaceholder: "Escribí el título del producto",
      productSubtitle: "Subtítulo del producto",
      productSubtitlePlaceholder: "Escribí el subtítulo del producto",
      footerText: "Texto del pie",
      footerTextPlaceholder: "Escribí el texto del pie",
      orgDisplayName: "Nombre de la institución",
      orgDisplayNamePlaceholder: "Escribí el nombre de la institución",
      defaultTimezone: "Zona horaria",
      timezonePlaceholder: "Elegí una zona horaria",
      actions: {
        saving: "Guardando...",
        save: "Guardar configuración",
      },
    },
    forms: {
      exam: {
        sectionBasic: "Datos básicos",
        title: "Nombre del examen",
        titlePlaceholder: "Ingresá el nombre del examen",
        course: "Comisión",
        coursePlaceholder: "Elegí una comisión",
        description: "Indicaciones",
        descriptionPlaceholder: "Opcional",
        sectionTime: "Tiempo",
        startTime: "Inicio",
        endTime: "Fin",
        duration: "Duración (minutos)",
        latestStart: "Ingreso más tarde (minutos desde el inicio)",
        minSubmit: "Mínimo para entregar (minutos desde el inicio)",
        noLimit: "Vacío = sin límite",
        timingMode: "Modo de tiempo",
        timingModeHint: {
          timed_window:
            "El alumno responde con un tiempo límite dentro de la ventana de apertura. Si se acaba, el examen se entrega solo.",
          deadline:
            "No hay cuenta regresiva propia. Hay que entregar antes de la fecha límite.",
          untimed:
            "Sin límite de tiempo: se responde cuando sea, sin fecha límite.",
        },
        timingModeValue: {
          timed_window: "Ventana horaria",
          deadline: "Fecha límite",
          untimed: "Sin límite de tiempo",
        },
        sectionScore: "Puntaje",
        totalScore: "Puntaje total",
        autoCalc: "Cálculo automático",
        manualInput: "Carga manual",
        autoCalcLabel: "Cálculo automático: {{score}} puntos",
        passingScore: "Puntaje para aprobar",
        sectionRetake: "Volver a rendir",
        retakePolicy: "Volver a rendir",
        unlimited: "Sin tope",
        maxAttempts: "Con tope",
        passThenStop: "Hasta aprobar",
        maxAttemptsLabel: "Tope de intentos",
        scoreStrategy: "Qué puntaje cuenta",
        highest: "El más alto",
        latest: "El último",
        first: "El primero",
        sectionControl: "Controles",
        shuffleQuestions: "Mezclar las preguntas",
        restrictSimultaneousAccess: "Restringir acceso simultáneo",
        shuffleOptions: "Mezclar las opciones",
        resultPublication: "Cuándo se publican",
        immediate: "Al entregar",
        afterGrading: "Al corregir",
        manualPublication: "Cuando un administrador las publique",
        timeInvalid: "La hora de fin tiene que ser posterior al inicio",
        scoreMismatch:
          "El puntaje total no coincide con la suma de las preguntas (tiene que ser {{score}})",
        passingScoreExceeds:
          "El puntaje para aprobar no puede superar el total ({{passing}} > {{total}})",
      },
      question: {
        type: "Tipo de pregunta",
        typeSingleChoice: "Una opción",
        typeMultipleChoice: "Varias opciones",
        typeFillBlank: "Completar espacios",
        typeTrueFalse: "Verdadero o falso",
        typeTextResponse: "Texto libre",
        rubric: "Criterio de corrección",
        rubricPlaceholder:
          "Describí qué hay que mirar al corregir: los puntos clave, si está completo, si es exacto o cómo argumenta",
        rubricHint:
          "Es la base de la corrección. En una respuesta de texto libre, el criterio tiene que tener texto antes de publicar el examen.",
        referenceAnswer: "Respuesta de referencia (opcional)",
        referenceAnswerPlaceholder:
          "Ejemplo para quien corrige. No cambia la corrección automática.",
        referenceAnswerHint:
          "Solo lo ve quien corrige. No entra en la corrección automática y el alumno no lo ve. Si lo dejás vacío, no se guarda.",
        optionTrue: "Sí",
        optionFalse: "No",
        content: "Enunciado",
        contentPlaceholder: "Escribí el enunciado",
        contentFillBlankPlaceholder:
          "Escribí el enunciado y marcá cada espacio con ____",
        options: "Opciones",
        addOption: "Agregar opción",
        removeOption: "Quitar opción {{id}}",
        optionPlaceholder: "Opción {{id}}",
        optionContent: "Texto de la opción {{id}}",
        answerMode: "Cómo responde",
        answerModeHint:
          "Elegí si el alumno escribe en texto plano o en el editor con formato, que permite fórmulas y estilo.",
        standardAnswer: "Respuesta correcta",
        standardAnswerPlaceholder:
          "Escribí la respuesta correcta. Si hay varias, separalas con |",
        standardAnswerHint:
          "Si hay varias respuestas válidas, separalas con |. Por ejemplo: átomo|atom",
        score: "Puntos",
        difficulty: "Dificultad (1-5)",
        tags: "Etiquetas",
        tagsPlaceholder: "Separadas por comas",
        multiSelectScoring: "Puntaje con varias opciones",
        allCorrectFull: "Puntaje completo solo si está todo bien",
        partialHalf: "La mitad del puntaje si está a medias",
        fillBlankMatchMode: "Cómo se compara el espacio",
        exactMatch: "Texto exacto",
        keywordMatch: "Palabras clave",
        caseSensitive: "Respetar mayúsculas",
      },
      user: {},
      candidate: {},
      course: {},
    },
    importWizard: {
      rowPrefix: "Fila {{row}}:",
      statusCreate: "Creado",
      statusUpdate: "Actualizado",
      statusError: "Incorrecto",
      close: "Cerrar",
      confirmImport: "Confirmar importación",
      selectCsv: "Elegir CSV",
    },
    importLogs: {
      title: "Registro de importaciones",
      description: "Historial de importaciones de alumnos y de preguntas",
      empty: "No hay importaciones",
      emptyDescription: "Cada importación queda registrada acá",
      loadFailed: "No se pudo cargar el registro de importaciones",
      clearFilter: "Quitar filtros",
      typeFilter: "Todos los tipos",
      typeFilters: {
        all: "Todos los tipos",
        candidate: "Importación de alumnos",
        question: "Importar preguntas",
      },
      typeLabels: {
        candidate: "Importación de alumnos",
        question: "Importar preguntas",
      },
      statusConfig: {
        completed: "Completado",
        partial: "Parcial",
        failed: "Fallido",
      },
      columns: {
        time: "Fecha",
        type: "Tipo",
        status: "Estado",
        total: "Total",
        created: "Creado",
        updated: "Actualizado",
        errors: "Incorrecto",
      },
      details: {
        errorDetail: "Detalle del error",
        metadata: "Metadatos",
      },
    },
    scores: {
      title: "Calificaciones",
      empty: "No hay calificaciones registradas",
    },
    results: {
      title: "Resumen de calificaciones",
      empty: "No hay datos de calificaciones",
    },
    examDetail: {
      errors: {
        loadFailed: "No se pudo cargar el examen",
        dataLoadFailed:
          "Los datos del examen no cargaron bien. Intentá de nuevo.",
        loadEnrollmentsFailed: "No se pudo cargar la lista de alumnos",
        loadCandidatesFailed: "No se pudo cargar la lista de alumnos",
        loadMoreFailed: "No se pudieron cargar más alumnos",
        addFailed: "No se pudo agregar al alumno",
        removeFailed: "No se pudo quitar al alumno",
        publishFailed: "No se pudo publicar. Intentá de nuevo más tarde.",
        closeFailed: "No se pudo cerrar. Intentá de nuevo más tarde.",
        unpublishFailed:
          "No se pudo retirar la publicación. Intentá de nuevo más tarde.",
        publishResultsFailed:
          "No se pudieron publicar las calificaciones. Intentá de nuevo más tarde.",
        extendFailed: "No se pudo extender. Intentá de nuevo más tarde.",
        extendStaleClosedRecovered:
          "El examen ya está cerrado, así que no se puede extender. El estado ya está actualizado.",
        extendStaleClosedRefreshFailed:
          "El examen ya está cerrado, así que no se puede extender. No se pudo cargar el estado nuevo. Intentá de nuevo.",
        archiveFailed: "No se pudo archivar. Intentá de nuevo más tarde.",
        cancelFailed: "No se pudo cancelar. Intentá de nuevo más tarde.",
      },
      actions: {
        edit: "Editar",
        preview: "Vista previa",
        publish: "Publicar examen",
        publishing: "Publicando...",
        close: "Cerrar examen",
        closing: "Cerrando...",
        extend: "Extender el tiempo",
        proctor: "Supervisión",
        unpublish: "Retirar publicación",
        unpublishing: "Retirando...",
        archive: "Archivar",
        archiving: "Archivando...",
        cancel: "Cancelar examen",
        canceling: "Cancelando...",
        publishResults: "Publicar calificaciones",
        publishResultsLoading: "Publicando...",
        backToList: "Volver a la lista",
      },
      confirm: {
        closeTitle: "Cerrar examen",
        closeDescription:
          "¿Cerrar «{{title}}»? El examen termina y los alumnos no pueden empezar un intento nuevo.",
        unpublishTitle: "Retirar publicación",
        unpublishDescription:
          "¿Retirar la publicación de «{{title}}»? Vuelve a borrador y se puede volver a editar.",
        archiveTitle: "Archivar examen",
        archiveDescription:
          "¿Archivar «{{title}}»? Sale de la lista de exámenes actuales.",
        cancelTitle: "Cancelar examen",
        cancelDescription:
          "¿Cancelar «{{title}}»? Si estaba publicado, queda anulado. No se puede deshacer.",
        publishResultsTitle: "Publicar calificaciones",
        publishResultsDescription:
          "¿Publicar las calificaciones de «{{title}}»? Los alumnos van a poder verlas.",
        removeTitle: "Quitar",
        removeDescription: "¿Quitar a «{{name}}»?",
        removeCandidate: "Quitar alumno",
      },
      stats: {
        status: "Estado",
        duration: "Duración del examen",
        durationValue: "{{minutes}} minutos",
        deadlineMode: "Con hora límite",
        noDuration: "Sin límite de tiempo",
        passingScore: "Puntaje para aprobar",
        questionCount: "Cantidad de preguntas",
        participantCount: "Participantes",
        completedCount: "Completados",
        passedCount: "Aprobados",
      },
      config: {
        title: "Configuración del examen",
        timingMode: "Modo de tiempo:",
        retakePolicy: "Volver a rendir:",
        scoreStrategy: "Qué puntaje cuenta:",
        maxAttempts: "Tope de intentos:",
        startTime: "Inicio:",
        endTime: "Fin:",
      },
      tabs: {
        enrollment: "Inscripción",
        scores: "Calificación",
      },
      enrollment: {
        title: "Alumnos habilitados",
        addCandidate: "Agregar alumno",
        emptyTitle: "No hay alumnos",
        emptyDescription: "Todavía no hay alumnos asignados a este examen.",
        columns: {
          identity: "Legajo",
          name: "Nombre",
          status: "Estado",
          attemptCount: "Intentos",
          score: "Calificación",
          actions: "Acciones",
        },
      },
      scoresTab: {
        title: "Gestión de calificaciones",
        description: "Mirá y exportá las calificaciones de este examen.",
        goToScores: "Ir a la gestión de calificaciones",
      },
      addDialog: {
        title: "Agregar alumno",
        emptyCandidates:
          "No hay alumnos para agregar. Creálos primero en la gestión de alumnos.",
        cancel: "Cancelar",
        add: "Agregar ({{count}})",
        adding: "Agregando...",
      },
      extendDialog: {
        title: "Extender el tiempo del examen",
        minutesLabel: "Minutos a sumar",
        cancel: "Cancelar",
        confirm: "Extender {{minutes}} minutos",
        confirming: "Extendiendo...",
      },
      toast: {
        added: "Alumno agregado",
        removed: "Alumno quitado",
        published: "Examen publicado",
        closed: "Examen cerrado",
        unpublished: "Publicación retirada",
        resultsPublished: "Calificaciones publicadas",
        extended: "Se sumaron {{minutes}} minutos",
        archived: "Examen archivado",
        canceled: "Examen cancelado",
      },
    },
    attemptDetail: {
      /** Timeline event labels — distinct vocabulary from audit filterActions. */
      events: {
        start: "Empezó a responder",
        saveAnswer: "Guardó la respuesta",
        disrupted: "Se cortó la conexión",
        restore: "Volvió a conectarse",
        submit: "Entregó el examen",
        autoSubmit: "Entrega automática",
        forceSubmit: "Entrega forzada por un administrador",
        extendTime: "Un administrador sumó tiempo",
        grantTime: "Se otorgó tiempo de examen",
        misconductFlagged: "Marcar irregularidad",
        scoreEntered: "Puntaje cargado",
        finalized: "Corrección terminada",
      },
      timeline: {
        title: "Línea de tiempo del intento",
        loadFailed: "No se pudo cargar la línea de tiempo",
        emptyTitle: "Todavía no hay eventos",
        emptyDescription: "Acá se van a ver las acciones de este intento",
        actorPrefix: "Autor",
        ipAddress: "IP: {{address}}",
      },
      errors: {
        loadFailed: "No se pudo cargar el detalle del intento",
        resultHidden:
          "Este intento todavía no está corregido, o el resultado no se puede ver",
        dataLoadFailed: "Las respuestas no cargaron bien. Intentá de nuevo.",
        scoreDataLoadFailed:
          "Las calificaciones no cargaron bien. Intentá de nuevo.",
        statusSubmitted: "Este intento ya se entregó. Falta la corrección.",
        statusGradedHidden:
          "Este intento ya está corregido, pero la calificación todavía no está publicada.",
        exportFailed: "No se pudo exportar. Intentá de nuevo más tarde.",
      },
      actions: {
        exportCsv: "Exportar CSV",
        exportJson: "Exportar JSON",
        back: "Volver",
        flagMisconduct: "Marcar irregularidad",
      },
      /** Timeline-only view for callers without score-read capability. */
      shell: {
        title: "Detalle del intento",
      },
      live: {
        titleSuffix: "Detalle del intento",
        statusTitle: "Estado del intento",
        flagDialog: {
          title: "Marcar irregularidad",
          description:
            "Deja registro de una conducta del alumno. No cambia el estado del intento.",
          severityLabel: "Gravedad",
          severityWarning: "Advertencia",
          severitySerious: "Crítico",
          notesLabel: "Detalle de la irregularidad",
          notesPlaceholder: "Por ejemplo: el alumno miró el celular",
          cancel: "Cancelar",
          submitting: "Enviando…",
          confirm: "Confirmar",
        },
      },
      flag: {
        notesRequired: "Describí la irregularidad",
        flagged: "Irregularidad marcada",
        flagFailed:
          "No se pudo marcar la irregularidad. Intentá de nuevo más tarde.",
      },
      result: {
        titleSuffix: "Detalle del intento",
        summaryTitle: "Resumen de la calificación",
        totalScore: "Puntaje total",
        earnedScore: "Puntaje",
        passingLine: "Mínimo para aprobar",
        status: "Estado",
        detailTitle: "Detalle del intento",
        columns: {
          number: "N.º",
          content: "Pregunta",
          type: "Tipo",
          candidateAnswer: "Respuesta del alumno",
          standardAnswer: "Respuesta correcta",
          score: "Puntaje",
          maxScore: "Puntaje máximo",
        },
      },
    },
    proctorDashboard: {
      title: "Supervisión",
      errors: {
        loadFailed: "No se pudieron cargar los datos de supervisión",
        forceSubmitFailed: "No se pudo forzar la entrega",
        extendFailed: "No se pudo extender",
        flagFailed: "No se pudo marcar la irregularidad",
      },
      actions: {
        refresh: "Actualizar",
        monitor: "Monitoreo en vivo",
        back: "Volver",
      },
      tabs: {
        all: "Todos ({{count}})",
        active: "Respondiendo ({{count}})",
        disrupted: "Desconectados ({{count}})",
        submitted: "Entregados ({{count}})",
        graded: "Corregidos ({{count}})",
      },
      empty: {
        title: "No hay datos de alumnos",
        description: "En este momento no hay alumnos rindiendo.",
        filteredTitle: "No hay datos",
        filteredDescription: "Ningún alumno coincide con este filtro.",
      },
      card: {
        deadline: "Fecha límite",
        lastActivity: "Última actividad",
        misconductPrefix: "Irregularidad",
        severitySerious: "Crítico",
        severityWarning: "Advertencia",
        forceSubmit: "Forzar entrega",
        extend: "Extender el tiempo",
        flag: "Marcar irregularidad",
      },
      forceSubmit: {
        title: "Confirmar entrega forzada",
        description: "¿Forzar la entrega de «{{name}}»? No se puede deshacer.",
        reason: "Entrega forzada por un administrador",
        done: "Entrega forzada enviada",
        indeterminate:
          "No se confirmó el envío de la entrega forzada. Podés reintentar: se usa el mismo comando.",
        retry: "Reintentar entrega forzada",
        retryDescription:
          "No se confirmó el envío anterior (puede que sí haya llegado). El reintento usa exactamente el mismo identificador de comando. El servidor lo ejecuta solo si todavía no lo hizo.",
        dismiss: "Limpiar comando sin confirmar",
        blockedPending:
          "Hay una entrega forzada sin confirmar. Resolvela antes de seguir.",
        persistenceFailed:
          "No se pudo guardar el comando de entrega forzada. Revisá el permiso de almacenamiento del navegador e intentá de nuevo.",
        corruptCleared:
          "Había un registro dañado de una entrega forzada sin confirmar. Ya se descartó. Volvé a iniciar la acción.",
        bannerTitle: "Hay una entrega forzada sin confirmar",
        bannerBody:
          "No se confirmó el envío anterior: puede que haya llegado, o que no. El botón de abajo reintenta con exactamente el mismo identificador. El servidor lo ejecuta solo si todavía no lo hizo.",
        bannerOtherExamTitle:
          "Hay una entrega forzada sin confirmar (es de otro examen)",
        bannerOtherExamBody:
          "El comando corresponde al examen «{{examId}}», alumno «{{candidateName}}». Para no forzar la entrega en el examen equivocado, volvé a la página de ese examen o descartá el registro.",
        bannerGoToExam: "Volver a ese examen",
        candidateFallback: "Alumno ({{attemptId}})",
        bannerRetry: "Reintentar la entrega sin confirmar",
        bannerDismiss: "Limpiar comando sin confirmar",
        dismissFailed:
          "No se pudo descartar la entrega forzada sin confirmar. Revisá el permiso de almacenamiento del navegador e intentá de nuevo.",
        cleanupFailed:
          "La entrega forzada ya está confirmada, pero no se pudo borrar el registro de este navegador. No se va a ejecutar dos veces, aunque puede bloquear una entrega forzada nueva. Actualizá la página y borrá el registro.",
        cleanupFailedBannerTitle:
          "La entrega forzada ya está confirmada, pero no se pudo limpiar el registro local",
        cleanupFailedBannerBody:
          "No se va a ejecutar dos veces, aunque puede bloquear una entrega forzada nueva. Hacé clic en «Descartar» para borrar el registro, o actualizá la página.",
      },
      extendDialog: {
        title: "Extender el tiempo del examen",
        description: "Sumar tiempo de examen a {{name}}",
        minutesLabel: "Minutos a sumar",
        reasonCodeLabel: "Motivo",
        reasonCodeTechnicalIncident: "Falla técnica",
        reasonCodeCandidateRequest: "Pedido del alumno",
        reasonCodeOther: "Otro",
        reasonTextLabel: "Detalle del motivo",
        reasonTextPlaceholder: "Explicá por qué se suma tiempo",
        cancel: "Cancelar",
        confirm: "Extender {{minutes}} minutos",
        confirming: "Extendiendo...",
        retry: "Reintentar este tiempo extra",
        done: "Se sumaron {{minutes}} minutos",
        doneReplay: "Ese tiempo extra ya estaba hecho. No se sumó de nuevo.",
        doneTerminal: "El examen ya había terminado. No se sumó tiempo.",
        indeterminate:
          "No se sabe si el tiempo extra se aplicó. Reintentá el mismo comando para confirmar el resultado.",
        indeterminateBanner:
          "El pedido anterior de tiempo extra no tiene un resultado confirmado. El reintento usa el mismo identificador y no suma los minutos dos veces.",
        idempotencyConflict:
          "Ese identificador ya se usó en otro pedido, con otros datos. Pedí el tiempo extra de nuevo.",
        blockedByPending:
          "Hay un tiempo extra sin confirmar ({{minutes}} minutos). Reintentá o resolvelo antes de sumarle tiempo a otro alumno.",
        coordinationUnavailable:
          "No se puede coordinar un tiempo extra pendiente en otras pestañas. Cerrá las otras pestañas de exámenes, o recuperá el almacenamiento del navegador, y volvé a intentar.",
        clearStaleWarning:
          "El tiempo extra ya está confirmado, pero no se pudo limpiar el estado pendiente entre pestañas. Actualiza la página o cierra las otras pestañas de gestión de exámenes.",
        leaseConflict:
          "Otra pestaña está procesando este tiempo extra. Intentá de nuevo en un rato.",
        releaseFailedWarning:
          "No se pudo actualizar el estado compartido entre pestañas. Reintentá el mismo comando más tarde.",
        resolvedInAnotherTab: "Este tiempo extra ya se procesó en otra pestaña",
      },
      misconductDialog: {
        title: "Marcar irregularidad",
        description: "Marcar una irregularidad de {{name}}",
        severityLabel: "Gravedad",
        severityWarning: "Advertencia",
        severitySerious: "Crítico",
        notesLabel: "Detalle de la irregularidad",
        notesPlaceholder: "Describí la irregularidad",
        cancel: "Cancelar",
        flagging: "Marcando...",
        confirm: "Confirmar",
        done: "Irregularidad marcada",
        defaultNotes: "Marca de supervisión",
        indeterminate:
          "No se confirmó si la irregularidad quedó marcada. Podés reintentar: se usa el mismo comando.",
        retry: "Reintentar la marca",
        retryDescription:
          "No se confirmó el envío anterior (puede que sí haya llegado). El reintento usa exactamente el mismo identificador, la misma gravedad y la misma descripción. El servidor lo ejecuta solo si todavía no lo hizo.",
        persistenceFailed:
          "No se pudo guardar el comando de la irregularidad. Revisá el permiso de almacenamiento del navegador e intentá de nuevo.",
        corruptCleared:
          "Había un registro dañado de una irregularidad sin confirmar. Ya se descartó. Volvé a iniciar la acción.",
        blockedPending:
          "Hay una irregularidad sin confirmar. Resolvela antes de seguir.",
        cleanupFailed:
          "La irregularidad ya está confirmada, pero no se pudo borrar el registro de este navegador. No se va a ejecutar dos veces, aunque puede bloquear una marca nueva. Actualizá la página y borrá el registro.",
        dismissFailed:
          "No se pudo descartar la irregularidad sin confirmar. Revisá el permiso de almacenamiento del navegador e intentá de nuevo.",
        bannerTitle: "Hay una irregularidad sin confirmar",
        bannerBody:
          "No se confirmó el envío anterior para el alumno «{{candidateName}}»: puede que haya llegado, o que no. El botón de abajo reintenta con exactamente el mismo identificador. El servidor lo ejecuta solo si todavía no lo hizo.",
        bannerRetry: "Reintentar la marca sin confirmar",
        bannerDismiss: "Limpiar comando sin confirmar",
        cleanupFailedBannerTitle:
          "La irregularidad ya está confirmada, pero no se pudo limpiar el registro local",
        cleanupFailedBannerBody:
          "No se va a ejecutar dos veces, aunque puede bloquear una marca nueva. Hacé clic en «Descartar» para borrar el registro, o actualizá la página.",
      },
    },
    proctorWorkspace: {
      title: "Mesa de supervisión",
      description: "Elegí un examen para supervisar en vivo",
      tableTitle: "Exámenes para supervisar",
      statusFilter: "Estado del examen",
      statusFilters: {
        all: "Todos los estados",
        published: "Publicado",
        open: "Abierto",
        closed: "Cerrado",
      },
      columns: {
        title: "Nombre del examen",
        status: "Estado",
        openAt: "Apertura",
        closeAt: "Fin",
        actions: "Acciones",
      },
      actions: {
        enter: "Entrar a supervisar",
      },
      empty: {
        title: "No hay exámenes para supervisar",
        description:
          "Acá aparecen los exámenes publicados, abiertos o cerrados.",
        filteredTitle: "Ningún examen para supervisar coincide con este filtro",
        filteredDescription: "Elegí otro estado del examen.",
      },
      loading: "Cargando exámenes para supervisar...",
      loadFailed: "No se pudieron cargar los exámenes para supervisar",
    },
    questionImport: {
      title: "Importar preguntas",
      /** Downloaded CSV template filename (CSV artifact, not UI copy). */
      templateFilename: "plantilla-importacion-preguntas.csv",
      errors: {
        loadCoursesFailed: "No se pudo cargar la lista de comisiones",
        importFailed: "No se pudo importar",
      },
      courseLabel: "Comisión de destino",
      coursePlaceholder: "Elegí una comisión",
      downloadTemplate: "Descargar plantilla",
      parsed: "{{count}} filas leídas",
      moreRows: "...y {{count}} filas más",
      validate: "Validar la importación",
      validating: "Validando...",
      confirm: "Confirmar importación",
      importing: "Importando...",
      backToList: "Volver a las preguntas",
      continueImport: "Seguir importando",
      previewColumns: {
        row: "Fila",
        type: "Tipo",
        content: "Enunciado",
        score: "Puntos",
        status: "Estado",
        detail: "Detalle",
      },
      result: {
        valid: "Válidas",
        warnings: "Advertencia",
        errors: "Incorrecto",
      },
    },
    scoreList: {
      titleSuffix: "Gestión de calificaciones",
      errors: {
        loadFailed: "No se pudo cargar la lista de calificaciones",
        dataLoadFailed:
          "Las calificaciones no cargaron bien. Intentá de nuevo.",
        exportFailed: "No se pudo exportar. Intentá de nuevo más tarde.",
      },
      backToResults: "Volver a la consulta de calificaciones",
      actions: {
        export: "Exportar CSV",
        exporting: "Exportando...",
        backToDetail: "Volver al examen",
        viewDetail: "Ver detalle",
      },
      stats: {
        average: "Promedio",
        max: "Más alto",
        min: "Más bajo",
        passRate: "Porcentaje de aprobación",
        totalGraded: "Calificado",
      },
      filters: {
        label: "Filtrar calificaciones",
        all: "Todos",
        passed: "Aprobado",
        failed: "Desaprobado",
      },
      listTitle: "Lista de calificaciones",
      empty: {
        title: "Sin calificaciones",
        description: "Este examen todavía no tiene respuestas corregidas",
      },
      columns: {
        candidateName: "Nombre del alumno",
        candidateInfo: "Datos del alumno",
        score: "Calificación",
        status: "Estado",
        submittedAt: "Fecha de entrega",
        actions: "Acciones",
      },
      fallbackExamTitle: "Exámenes",
    },
    dashboard: {
      title: "Panel",
      errors: {
        loadFailed: "No se pudo cargar el panel",
      },
      stats: {
        totalQuestions: "Total de preguntas",
        activeExams: "Exámenes en curso",
        totalCandidates: "Total de alumnos",
        todayExams: "Exámenes de hoy",
      },
      todo: {
        sectionTitle: "Pendientes",
        grading: {
          label: "Calificación manual pendiente",
          unit: "entregas",
          zero: "No hay entregas pendientes de calificar",
          cta: "Ir a la cola de calificación",
        },
        incidents: {
          label: "Incidentes pendientes",
          unit: "incidentes",
          zero: "No hay incidentes sin resolver",
          cta: "Ir a la revisión de recuperación",
        },
        unknownValue: "No se pudo obtener",
        staleCaption: "Los datos pueden estar desactualizados",
        refreshing: "Actualizando…",
        retry: "Reintentar",
        refresh: "Actualizar",
      },
      actions: {
        createExam: "Crear examen",
        importQuestions: "Importar preguntas",
      },
      recent: {
        title: "Exámenes recientes",
        emptyTitle: "No hay exámenes",
        emptyDescription: "Todavía no se creó ningún examen",
        columns: {
          title: "Nombre del examen",
          status: "Estado",
          participantCount: "Participantes",
          actions: "Acciones",
        },
        viewExamLabel: "Ver examen {{title}}",
      },
    },
    resultsOverview: {
      title: "Calificaciones",
      cardTitle: "Gestión de calificaciones",
      errors: {
        loadFailed: "No se pudo cargar la lista de exámenes",
      },
      empty: {
        title: "No hay exámenes relacionados",
        description:
          "Los exámenes finalizados, archivados o en curso se muestran aquí",
      },
      actions: {
        viewScores: "Ver calificación",
      },
      columns: {
        title: "Nombre del examen",
        status: "Estado",
        time: "Fecha del examen",
        gradedCount: "Calificado",
        actions: "Acciones",
      },
    },
    gradingDetail: {
      title: "Calificación manual",
      /** One-time-irreversible-scoring banner shown above the question list. */
      irrevocableNotice:
        "Una vez enviada, la calificación no se puede modificar. Confirma el puntaje y el comentario.",
      /** Banner shown once the whole attempt is fully graded. */
      fullyGradedNotice: "La calificación está completa.",
      errors: {
        loadFailed: "No se pudo cargar el detalle de la calificación",
        dataLoadFailed:
          "No se pudieron cargar los datos de la calificación. Inténtalo de nuevo.",
        saveFailed: "No se pudo guardar. Inténtalo de nuevo.",
        /** Case B: POST failed AND server confirms the entry is still pending. */
        submitFailed:
          "La calificación no se envió. Revisa la conexión e inténtalo de nuevo.",
        /** Case A: POST errored but the authoritative GET shows the entry was
         *  actually committed (response lost, or another grader committed). */
        reconciledCommitted:
          "La calificación ya se envió. La página muestra el estado más reciente.",
        /** Case C: attempt became fully graded / question changed under us. */
        reconciledStateChanged:
          "El estado de la corrección cambió. Se cargó el resultado más reciente.",
        /** Failure-of-failure: both POST and the reconciliation GET failed. */
        submitUnknown:
          "No se puede confirmar si la calificación se envió. Actualiza la página para verificar.",
      },
      actions: {
        backToQueue: "Volver a la cola",
      },
      question: {
        maxScore: "Puntaje máximo: {{score}}",
        subjective: "Abierta",
        candidateAnswer: "Respuesta del alumno",
        standardAnswer: "Respuesta de referencia",
        rubric: "Criterios de calificación",
        scoreLabel: "Puntaje",
        commentLabel: "Comentario (opcional)",
        commentPlaceholder: "Escribe un comentario...",
        submit: "Enviar calificación",
        submitting: "Enviando...",
        submittedLabel: "Calificación enviada",
        gradedLabel: "Calificado: {{score}} puntos",
        gradedBy: "Calificado por: {{grader}}",
        gradedAt: "Fecha de calificación: {{time}}",
      },
      confirm: {
        title: "¿Confirmar el envío de la calificación?",
        description:
          "Después de enviarla, esta pregunta no se puede modificar. Confirma el puntaje y el comentario.",
        score: "Puntaje: {{score}}",
        maxScore: "Puntaje máximo: {{score}}",
        irrevocable:
          "Después de enviarla, no se puede cambiar con la corrección habitual.",
        confirm: "Confirmar envío",
        cancel: "Cancelar",
      },
      validation: {
        scoreRequired: "Ingresa el puntaje",
        scoreNegative: "El puntaje no puede ser negativo",
        scoreExceedsMax: "El puntaje no puede superar el máximo ({{max}})",
      },
      format: {
        unanswered: "Sin responder",
        correct: "Correcto",
        incorrect: "Incorrecto",
        notSet: "Sin definir",
      },
      toast: {
        fullyGraded: "Calificación completa",
        saved: "Calificación guardada",
      },
    },
    /** EnrollmentPicker (exam enrollment candidate picker) copy. */
    enrollmentPicker: {
      searchPlaceholder: "Buscar alumno",
      selectAll: "Seleccionar todo",
      empty: "Sin resultados",
      added: "Agregado",
      loading: "Cargando...",
      loadMore: "Cargar más",
    },
    /** QuestionPreview (candidate-perspective read-only preview) copy. */
    questionPreview: {
      title: "Vista del alumno",
      emptyContent: "(La pregunta está vacía)",
      standardAnswer: "Respuesta correcta:",
      notSet: "Sin definir",
    },

    /** Recovery Center — queue page (contract §5.4). */
    recoveryQueue: {
      title: "Revisión de recuperación",
      description:
        "Revisión de recuperación para la gestión: revisa interrupciones de la organización, entregas forzadas y compensaciones de tiempo, y define el estado final.",
      filters: {
        statusAll: "Todos los estados",
        severityAll: "Todas las gravedades",
        typeAll: "Todos los tipos",
        resolutionAll: "Todos los incidentes",
        unresolvedOnly: "Solo sin resolver",
        examPlaceholder: "ID del examen",
        candidatePlaceholder: "ID del alumno",
        startDate: "Fecha de inicio",
        endDate: "Fecha de fin",
        clear: "Limpiar filtros",
      },
      columns: {
        incident: "Incidente",
        severity: "Gravedad",
        exam: "Exámenes",
        candidate: "Alumno",
        attempt: "Intento",
        linked: "Vínculo",
        proctors: "Supervisores",
        createdAt: "Fecha",
      },
      severity: {
        info: "Información",
        minor: "Leve",
        major: "Crítico",
        critical: "Extrema",
      },
      status: {
        open: "Pendiente",
        investigating: "En investigación",
        resolved: "Resuelto",
        dismissed: "Descartado",
      },
      primaryAttempt: "Respondiendo",
      noAttempt: "Sin intento",
      noCandidate: "Sin alumno",
      linkedCount: "{{count}} vínculos",
      proctorCount: "{{count}} supervisores",
      loadMore: "Cargar más",
      loadingMore: "Cargando…",
      polling: "Actualización automática",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
      lastUpdatedAt: "Última actualización: {{time}}",
      snapshotAt: "Instantánea: {{time}}",
      snapshotStale:
        "La instantánea es antigua. Los datos pueden haber cambiado.",
      empty: "No hay interrupciones",
      emptyDescription: "Ninguna interrupción coincide con estos filtros.",
      loadFailed: "No se pudo cargar la cola de recuperación",
      permissionDenied:
        "No tienes permiso para usar la revisión de recuperación.",
      notFound: "No se encontró ningún incidente.",
      unavailable:
        "Los datos de recuperación no están disponibles. Inténtalo más tarde.",
      invalidFilter:
        "Los filtros no son válidos. Revísalos e inténtalo de nuevo.",
      networkError: "Problema de red. Revisa la conexión e inténtalo de nuevo.",
    },

    /** Recovery Center — incident detail page (contract §6.3). */
    recoveryIncident: {
      title: "Detalle del incidente",
      back: "Volver a la revisión de recuperación",
      snapshotAt: "Hora de la instantánea: {{time}}",
      snapshotStale:
        "La instantánea es antigua. Los datos pueden haber cambiado.",
      notFound: "No se encontró este incidente",
      notFoundDescription: "El incidente no existe o fue eliminado.",
      sections: {
        overview: "Resumen del incidente",
        exam: "Exámenes",
        candidates: "Alumno",
        attempts: "Intento",
        events: "Historial",
        notes: "Notas",
        actions: "Operaciones",
        memberships: "Asociar intento",
        interruptions: "Evidencia de interrupción",
        adjustments: "Compensación de tiempo",
        audit: "Auditoría",
      },
      header: {
        status: "Estado",
        severity: "Gravedad",
        type: "Tipo",
        createdAt: "Fecha de creación",
        version: "Versión",
        description: "Descripción",
      },
      reportedBy: "Informado por",
      resolvedBy: "Resuelto por",
      resolutionSummary: "Resolución",
      examCloseAt: "Cierre",
      noCandidates: "Sin datos del alumno",
      noAttempts: "Sin datos del intento",
      noEvents: "No hay historial",
      noNotes: "Sin notas",
      noActions: "Sin operaciones",
      noMemberships: "Sin intentos asociados",
      noInterruptions: "Sin evidencia de interrupción",
      noAdjustments: "Sin compensación de tiempo",
      noAudit: "Sin registros de auditoría",
      type: {
        network_interruption: "Corte de red",
        device_failure: "Falla del equipo",
        power_failure: "Corte de energía",
        candidate_unable_to_continue: "El alumno no puede continuar",
        suspected_misconduct: "Posible irregularidad",
        operator_error: "Error de operación",
        system_outage: "Falla del sistema",
        environmental_disruption: "Interferencia del entorno",
        other: "Otro",
      },
      actionType: {
        time_grant: "Compensación de tiempo",
        force_submit: "Forzar entrega",
      },
      relationshipType: {
        affected: "Afectado",
        referenced: "Referenciado",
      },
      // Keys are exactly the IncidentEventType domain values (ADR-014 §3) —
      // the timeline renders `eventType.${e.eventType}` from the wire, so a
      // missing key would surface as a raw i18n key to the operator.
      eventType: {
        incident_created: "Creación del incidente",
        investigation_started: "Iniciar investigación",
        note_added: "Agregar nota",
        severity_changed: "Cambiar gravedad",
        incident_resolved: "Resolver incidente",
        incident_dismissed: "Descartar incidente",
        action_linked: "Asociar operación",
        attempt_linked: "Asociar intento",
        interruption_linked: "Asociar interrupción",
      },
      policy: {
        strict: "Estricto",
        bounded_grace: "Tolerancia",
        operator_incident: "Intervención manual",
      },
      source: {
        bounded_grace: "Tolerancia automática",
        operator: "Manual",
        system_incident: "Incidente del sistema",
        administrative_correction: "Corrección administrativa",
      },
      attemptStatus: "Estado del intento",
      effectiveDeadline: "Cierre vigente",
      score: "Puntaje",
      addedSeconds: "Tiempo agregado",
      beforeDeadline: "Cierre anterior",
      afterDeadline: "Cierre nuevo",
      actor: "Operador",
      operationId: "ID de la operación",
      noPermission: "No tienes permiso para ver el detalle del incidente.",
      loadFailed: "No se pudo cargar el detalle del incidente",
      permissionDenied: "No tienes permiso para ver el detalle del incidente.",
      unavailable:
        "Los datos de recuperación no están disponibles. Inténtalo más tarde.",
      invalidFilter: "La solicitud no es válida.",
      networkError: "Problema de red. Revisa la conexión e inténtalo de nuevo.",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
    },

    /** Recovery Center — attempt operations page (contract §6.4). */
    recoveryAttempt: {
      title: "Operaciones del intento",
      back: "Volver a la revisión de recuperación",
      attemptNo: "Intento {{count}}",
      notFound: "No se encontró este intento",
      notFoundDescription: "El intento no existe o fue eliminado.",
      sections: {
        overview: "Resumen del intento",
        exam: "Exámenes",
        candidate: "Alumno",
        episodes: "Interrupciones",
        adjustments: "Ajustes de tiempo",
        timeline: "Línea de tiempo",
        relatedIncidents: "Incidentes asociados",
      },
      statusLabel: "Estado del intento",
      startedAt: "Inicio",
      submittedAt: "Entrega",
      gradedAt: "Fecha de calificación",
      lastActivityAt: "Última actividad",
      effectiveDeadline: "Cierre vigente",
      effectiveDeadlineDiffers:
        "El cierre vigente es distinto del original porque hubo un ajuste de tiempo.",
      misconduct: "Marca de irregularidad",
      misconductDescription: "Este intento está marcado como irregularidad.",
      examCloseAt: "Cierre del examen",
      episodeCount: "Interrupción {{count}}",
      detectedAt: "Detección",
      detectionSource: "Origen de la detección",
      timeoutSeconds: "Segundos de espera",
      eligibleSeconds: "Tiempo compensable",
      addedSeconds: "Tiempo agregado",
      policyLabel: "Política",
      sourceLabel: "Origen",
      beforeDeadline: "Cierre anterior",
      afterDeadline: "Cierre nuevo",
      reason: "Motivo",
      actor: "Operador",
      linkedIncident: "Incidentes asociados",
      linkedAdjustment: "Ajuste de tiempo",
      ledgerNote:
        "Listado completo de ajustes de tiempo, de todos los orígenes. En el detalle del incidente solo aparece la compensación de ese incidente.",
      noEpisodes: "Sin interrupciones",
      noAdjustments: "Sin ajustes de tiempo",
      noTimeline: "Sin operaciones",
      noRelatedIncidents: "Sin incidentes asociados",
      eventType: {
        detected: "Interrupción detectada",
        restored: "Restablecida",
        terminalized: "Cerrada",
      },
      policy: {
        strict: "Estricto",
        bounded_grace: "Tolerancia",
        operator_incident: "Intervención manual",
      },
      source: {
        bounded_grace: "Tolerancia automática",
        operator: "Manual",
        system_incident: "Incidente del sistema",
        administrative_correction: "Corrección administrativa",
      },
      loadFailed: "No se pudieron cargar las operaciones del intento",
      permissionDenied:
        "No tienes permiso para ver las operaciones del intento.",
      unavailable:
        "Los datos de recuperación no están disponibles. Inténtalo más tarde.",
      invalidFilter: "La solicitud no es válida.",
      networkError: "Problema de red. Revisa la conexión e inténtalo de nuevo.",
      snapshotAt: "Instantánea: {{time}}",
      snapshotStale:
        "La instantánea es antigua. Los datos pueden haber cambiado.",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
    },

    /** Recovery Center — exam recovery detail page (contract §6.5). */
    recoveryExam: {
      title: "Recuperación del examen",
      back: "Volver a la revisión de recuperación",
      viewInQueue: "Ver en la cola",
      notFound: "No se encontró este examen",
      notFoundDescription: "El examen no existe o fue eliminado.",
      sections: {
        exam: "Exámenes",
        incidents: "Resumen de incidentes",
        recentIncidents: "Incidentes recientes",
        proctors: "Supervisores",
        attempts: "Intentos por estado",
      },
      timingMode: "Modo de tiempo",
      timingModeValue: {
        timed_window: "Ventana horaria",
      },
      examCloseAt: "Cierre",
      incidentTotal: "Total de incidentes",
      noRecentIncidents: "No hay incidentes",
      noProctors: "No hay supervisores",
      noAttempts: "No hay intentos",
      attemptCount: "{{count}} intentos",
      loadFailed: "No se pudo cargar la recuperación del examen",
      permissionDenied:
        "No tienes permiso para ver la recuperación del examen.",
      unavailable:
        "Los datos de recuperación no están disponibles. Inténtalo más tarde.",
      invalidFilter: "La solicitud no es válida.",
      networkError: "Problema de red. Revisa la conexión e inténtalo de nuevo.",
      snapshotAt: "Instantánea: {{time}}",
      snapshotStale:
        "La instantánea es antigua. Los datos pueden haber cambiado.",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
    },

    /** Recovery Center — dangerous operations. Shared by the attempt /
        incident / exam recovery pages; per-operation labels are `actions.*`. */
    recoveryOps: {
      operationsTitle: "Acciones",
      actions: {
        timeGrant: "Extender el tiempo del intento",
        timeGrantDone: "Tiempo del intento extendido",
        timeGrantFailed:
          "No se pudo extender el tiempo del intento. Inténtalo más tarde.",
        forceSubmit: "Forzar entrega",
        forceSubmitDone: "Entrega forzada enviada",
        markMisconduct: "Marcar irregularidad",
        markMisconductDone: "Irregularidad marcada",
        investigate: "Iniciar investigación",
        investigateDone: "Investigación iniciada",
        addNote: "Agregar nota",
        addNoteDone: "Nota agregada",
        changeSeverity: "Cambiar gravedad",
        changeSeverityDone: "Gravedad actualizada",
        resolve: "Resolver incidente",
        resolveDone: "Incidente resuelto",
        dismiss: "Descartar incidente",
        dismissDone: "Incidente descartado",
        assignProctor: "Asignar supervisor",
        assignProctorDone: "Supervisor asignado",
        revokeProctor: "Revocar supervisor",
        revokeProctorDone: "Supervisor revocado",
        linkAction: "Asociar operación",
        linkActionDone: "Operación asociada",
        linkInterruption: "Asociar interrupción",
        linkInterruptionDone: "Interrupción asociada",
        linkAttempt: "Asociar intento",
        linkAttemptDone: "Intento asociado",
      },
      indeterminateHint:
        "El servidor no pudo confirmar el resultado. Si reintentas, la operación no se ejecuta de nuevo.",
      indeterminate:
        "No se pudo confirmar el resultado de la operación. Reintenta en la ventana.",
      retry: "Reintentar",
      submitting: "Enviando…",
      abandonCommand: "Abandonar este comando",
      persistenceFailed:
        "No se pudo guardar el comando pendiente. El envío se canceló. Inténtalo de nuevo.",
      corruptCleared:
        "Se detectó un registro dañado de un comando pendiente y ya se eliminó.",
      blockedByPending:
        "Hay otro comando pendiente. Primero termínalo o abandónalo.",
      dismissFailed:
        "No se pudo eliminar el comando pendiente. Inténtalo más tarde.",
      coordinationUnavailable:
        "No se puede coordinar con seguridad el tiempo extra pendiente. Cierra las otras pestañas de gestión de exámenes, o recupera el almacenamiento del navegador, e inténtalo de nuevo.",
      leaseConflict:
        "Otra pestaña está procesando este tiempo extra. Inténtalo más tarde.",
      clearStaleWarning:
        "El tiempo extra ya está confirmado, pero no se pudo limpiar el estado pendiente entre pestañas. Actualiza la página o cierra las otras pestañas de gestión de exámenes.",
      resolvedInAnotherTab: "Este tiempo extra ya se procesó en otra pestaña",
      cleanupFailed:
        "El resultado de la operación ya está confirmado, pero no se pudo limpiar el registro pendiente local. Ese registro no vuelve a ejecutar la operación, aunque puede impedir una nueva del mismo tipo. Haz clic en «Limpiar» para borrarlo, o actualiza la página.",
      cleanupFailedBody:
        "Ese registro no vuelve a ejecutar la operación, aunque puede impedir una nueva del mismo tipo. Haz clic en «Limpiar» para borrarlo, o actualiza la página.",
      forceSubmitCleanupFailedTitle:
        "La entrega forzada ya está confirmada, pero no se pudo limpiar el registro local",
      misconductCleanupFailedTitle:
        "La irregularidad ya está confirmada, pero no se pudo limpiar el registro local",
      clearStaleCommand: "Limpiar comando sin confirmar",
      versionConflict:
        "Otra operación ya actualizó el incidente (conflicto de versión). Actualiza la página e inténtalo de nuevo.",
      rejectionFailed:
        "La operación fue rechazada. Actualiza la página e inténtalo de nuevo.",
      minutesLabel: "Tiempo extra (minutos)",
      minutesInvalid: "Ingresa un número entero de minutos mayor que cero",
      reasonCodeLabel: "Tipo de motivo",
      reasonTextLabel: "Detalle del motivo",
      reasonRequired: "Ingresa el detalle del motivo",
      reasonRequiredLabel: "Detalle del motivo (obligatorio)",
      reasonTooLong: "No puedes superar los {{count}} caracteres",
      notesLabel: "Detalle de la irregularidad",
      notesRequired: "Ingresa el detalle de la irregularidad",
      severityLabel: "Gravedad",
      severityRequired: "Selecciona la gravedad",
      severityWarning: "Advertencia",
      severitySerious: "Crítico",
      bodyLabel: "Texto de la nota",
      bodyRequired: "Ingresa el texto de la nota",
      resolutionSummaryLabel: "Resolución",
      resolutionSummaryRequired: "Ingresa la resolución",
      proctorUserIdLabel: "ID del supervisor",
      proctorUserIdRequired: "Ingresa el ID del supervisor",
      reasonCodeTechnicalIncident: "Falla técnica",
      reasonCodeCandidateRequest: "Pedido del alumno",
      reasonCodeOther: "Otro",
      timeGrantDescription:
        "Agrega {{minutes}} minutos al intento {{no}} de {{name}} y deja registrado un ajuste manual de tiempo.",
      forceSubmitDescription:
        "Fuerza la entrega del intento {{no}} de {{name}} ({{examTitle}}). La entrega es definitiva. Confírmala.",
      markMisconductDescription:
        "Marca el intento {{no}} de {{name}} ({{examTitle}}) como irregularidad.",
      investigateDescription:
        "Inicia la investigación del incidente {{id}} ({{description}}).",
      addNoteDescription: "Agrega una nota al incidente {{id}}.",
      changeSeverityDescription: "Cambia la gravedad del incidente {{id}}.",
      resolveDescription:
        "Resuelve el incidente {{id}}. Resolver es una decisión final y no se puede deshacer.",
      dismissDescription:
        "Descarta el incidente {{id}}. Descartar es una decisión final y no se puede deshacer.",
      assignProctorDescription: "Asigna un supervisor al examen «{{title}}».",
      revokeProctorDescription:
        "Revoca a {{name}} como supervisor del examen «{{title}}».",
      revokeConfirmLabel: "Confirmar revocación",
      actionTypeLabel: "Tipo de operación",
      actionTypeRequired: "Selecciona el tipo de operación",
      actionIdLabel: "ID del registro de operación",
      actionIdRequired: "Ingresa el ID del registro de operación",
      interruptionIdLabel: "ID del registro de interrupción",
      interruptionIdRequired: "Ingresa el ID del registro de interrupción",
      linkActionDescription:
        "Asocia un registro de operación ya existente al incidente {{id}}.",
      linkInterruptionDescription:
        "Asocia una evidencia de interrupción al incidente {{id}}.",
      linkAttemptDescription: "Asocia un intento al incidente {{id}}.",
    },

    /** Proctor Recovery Center worklist. */
    proctorRecovery: {
      title: "Resolución de supervisión",
      description:
        "Gestión y registro de incidentes durante el examen: crea incidentes, investiga, agrega notas y asocia evidencia.",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
      snapshotAt: "Instantánea: {{time}}",
      snapshotStale: "Datos desactualizados",
      lastUpdatedAt: "Última actualización: {{time}}",
      empty: "No hay incidentes",
      emptyDescription: "Ningún incidente coincide con este alcance.",
      scope: {
        organization: "Alcance: todos los exámenes de la organización",
        active_assignments: "Alcance: mis supervisiones actuales",
      },
      loadingMore: "Cargando…",
      loadMore: "Cargar más",
      filters: {
        statusAll: "Todos los estados",
      },
      columns: {
        incident: "Incidente",
        severity: "Gravedad",
        exam: "Exámenes",
        attempt: "Intento",
        createdAt: "Fecha de creación",
      },
      create: {
        title: "Crear incidente",
        description: "Crea un incidente para el examen seleccionado.",
        typeLabel: "Tipo de incidente",
        typeRequired: "Selecciona el tipo de incidente",
        examLabel: "Exámenes",
        examRequired: "Selecciona el examen",
        descriptionLabel: "Descripción del incidente",
        descriptionRequired: "Ingresa la descripción del incidente",
        done: "Incidente creado",
      },
    },

    /** Proctor Operations incident detail (projection identity: issue #606). */
    proctorRecoveryIncident: {
      title: "Detalle del incidente de supervisión",
      refresh: "Actualizar",
      refreshing: "Actualizando…",
      back: "Volver a la resolución de supervisión",
      notFound: "Incidente no encontrado",
      notFoundDescription:
        "Este incidente no existe o no tienes permiso para verlo.",
      snapshotStale: "Datos desactualizados",
      attemptIdLabel: "ID del intento asociado",
      attemptIdRequired: "Ingresa el ID del intento asociado",
      relationshipLabel: "Tipo de vínculo",
      relationshipRequired: "Selecciona el tipo de vínculo",
      actionTypeLabel: "Tipo de operación",
      actionTypeRequired: "Selecciona el tipo de operación",
      actionIdLabel: "ID del registro de operación",
      actionIdRequired: "Ingresa el ID del registro de operación",
      interruptionIdLabel: "ID del registro de interrupción",
      interruptionIdRequired: "Ingresa el ID del registro de interrupción",
      noEvents: "No hay eventos",
      noNotes: "Sin notas",
      sections: {
        overview: "Resumen",
        exam: "Datos del examen",
        events: "Línea de tiempo del incidente",
        notes: "Notas",
      },
    },
  },

  /** LoginPage + auth-context copy. */
  auth: {
    login: {
      usernameLabel: "Usuario",
      legajoLabel: "Nro. de Legajo",
      passwordLabel: "Contraseña",
      usernamePlaceholder: "Ingresa tu usuario",
      legajoPlaceholder: "Ingresa tu legajo",
      passwordPlaceholder: "Ingresa tu contraseña",
      usernameRequired: "Ingresa tu usuario",
      passwordRequired: "Ingresa tu contraseña",
      submit: "Iniciar sesión",
      submitting: "Ingresando...",
      forgotPassword: "¿Olvidaste tu contraseña?",
    },
    /** Public invitation-acceptance page. */
    invite: {
      description:
        "Recibiste una invitación para unirte. Configura tu cuenta para activarla.",
      usernameLabel: "Usuario",
      usernameRequired: "Ingresa tu usuario",
      usernameTooShort: "El usuario debe tener al menos 3 caracteres",
      nameLabel: "Nombre",
      nameRequired: "Ingresa tu nombre",
      passwordLabel: "Definir contraseña",
      passwordRequired: "Ingresa tu contraseña",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
      confirmPasswordLabel: "Confirmar contraseña",
      passwordMismatch: "Las contraseñas no coinciden",
      submit: "Activar cuenta",
      submitting: "Activando...",
      failed:
        "No se pudo activar la cuenta. El enlace puede ser inválido o haber vencido.",
      successMessage:
        "Cuenta activada. Inicia sesión con los datos que acabas de definir.",
      goLogin: "Ir a iniciar sesión",
      backToLogin: "Volver al inicio de sesión",
    },
    /** Public forgot-password page. Response is uniform by contract. */
    forgot: {
      description:
        "Ingresa tu usuario. El sistema enviará un enlace de restablecimiento al correo asociado a esa cuenta.",
      usernameLabel: "Usuario",
      usernameRequired: "Ingresa tu usuario",
      submit: "Enviar enlace de restablecimiento",
      submitting: "Enviando...",
      failed: "No se pudo enviar. Inténtalo más tarde.",
      sentMessage:
        "Si la cuenta existe y tiene un correo asociado, el enlace ya fue enviado. Tienes 60 minutos para restablecer la contraseña.",
      backToLogin: "Volver al inicio de sesión",
    },
    /** Public password-reset consumption page. */
    reset: {
      description:
        "Define la nueva contraseña. El enlace solo se puede usar una vez.",
      passwordLabel: "Contraseña nueva",
      passwordRequired: "Ingresa la nueva contraseña",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
      confirmPasswordLabel: "Confirmar contraseña nueva",
      passwordMismatch: "Las contraseñas no coinciden",
      submit: "Restablecer contraseña",
      submitting: "Enviando...",
      failed:
        "No se pudo restablecer la contraseña. El enlace puede ser inválido, haber vencido o ya estar usado.",
      successMessage:
        "Contraseña restablecida. Inicia sesión con la nueva contraseña.",
      goLogin: "Ir a iniciar sesión",
      backToLogin: "Volver al inicio de sesión",
    },
    /** AuthContext fallback messages (used only when no error.message). */
    errors: {
      loginFailed: "No se pudo iniciar sesión",
      logoutFailed: "No se pudo cerrar sesión",
      updateFailed: "No se pudo actualizar",
    },
  },

  /**
   * Launchpad first-install page copy. Initial installation only —
   * creates the first Admin and the internal default organization. NOT
   * signup, NOT login, NOT Admin recovery. Once initialized the page
   * redirects to /login.
   */
  launchpad: {
    title: "Configuración inicial",
    subtitle:
      "Crea la primera cuenta de administrador para terminar la configuración inicial",
    organizationNameLabel: "Nombre de la organización",
    organizationDisplayNameLabel:
      "Nombre visible de la organización (opcional)",
    adminNameLabel: "Nombre del administrador",
    adminUsernameLabel: "Usuario del administrador",
    adminPasswordLabel: "Contraseña del administrador",
    setupTokenLabel: "Token de configuración",
    organizationNamePlaceholder: "Ingresa el nombre de la organización",
    organizationDisplayNamePlaceholder:
      "Ingresa el nombre visible de la organización (opcional)",
    adminNamePlaceholder: "Ingresa el nombre del administrador",
    adminUsernamePlaceholder: "Ingresa el usuario del administrador",
    adminPasswordPlaceholder: "Ingresa la contraseña del administrador",
    setupTokenPlaceholder: "Ingresa el token de configuración",
    organizationNameRequired: "Ingresa el nombre de la organización",
    adminNameRequired: "Ingresa el nombre del administrador",
    adminUsernameRequired: "Ingresa el usuario del administrador",
    adminPasswordRequired: "Ingresa la contraseña del administrador",
    setupTokenRequired: "Ingresa el token de configuración",
    submit: "Terminar la configuración",
    submitting: "Configurando...",
    errors: {
      loadStatusFailed:
        "No se pudo comprobar el estado de la configuración inicial. Inténtalo más tarde.",
      bootstrapFailed:
        "No se pudo completar la configuración. Revisa los datos o el token e inténtalo de nuevo.",
    },
  },

  /** StartExamPage (candidate pre-exam page) copy. */
  startExam: {
    errors: {
      loadFailed: "No se pudo cargar la información del examen",
      notFound: "El examen no existe",
      startFailed: "No se pudo comenzar el examen. Inténtalo más tarde.",
      maxAttemptsReached:
        "Alcanzaste el máximo de intentos. No puedes comenzar el examen de nuevo.",
      alreadyPassed:
        "Ya aprobaste este examen. No necesitas rendirlo de nuevo.",
      notOpen: "El examen no está abierto en este momento.",
    },
    actions: {
      resume: "Continuar examen",
      retake: "Rendir de nuevo",
      start: "Comenzar examen",
      viewResult: "Ver calificación",
      entering: "Ingresando...",
    },
    info: {
      title: "Datos del examen",
      duration: "Duración del examen",
      durationValue: "{{minutes}} minutos",
      // deadline/untimed carry null duration; copy keys on timingMode, never
      // on durationMinutes (same rule as examList.meta).
      deadlineMode: "Con hora límite",
      noDuration: "Sin límite de tiempo",
      questionCount: "Cantidad de preguntas",
      questionCountValue: "{{count}} preguntas",
      passingScore: "Puntaje para aprobar",
    },
    notice: "Cuando empieza, el tiempo corre y no se puede pausar",
    attempts: "Intentos: {{used}}/{{max}}",
    bestScore: "Mejor calificación: {{score}}/{{total}}",
    bestScorePercent: "({{percent}}%)",
    inline: {
      activeAttempt:
        "Hay un intento sin terminar. Se retoma desde donde quedó.",
      maxAttemptsExhausted:
        "Alcanzaste el máximo de intentos. No puedes comenzar el examen de nuevo.",
      retakeAvailable:
        "Puedes rendirlo de nuevo. Se conserva la mejor calificación.",
    },
    // Durable admission queue — waiting/readiness truth only.
    queue: {
      joining: "Entrando en la fila...",
      title: "Fila de ingreso",
      waiting: "Esperando para ingresar",
      position: "Puesto {{position}}",
      ahead: "{{count}} personas por delante",
      estimated: "Espera estimada: {{seconds}} segundos",
      admitted: "Ingreso autorizado. Entrando al examen...",
    },
  },

  /** ExamLayout (candidate runtime shell) nav/menu copy. */
  examLayout: {
    myExams: "Mis exámenes",
    accountMenu: "Menú de la cuenta",
    accountSettings: "Configuración de la cuenta",
    logout: "Cerrar sesión",
  },

  /** NotificationBell + Inbox panel copy. */
  notifications: {
    bell: "Notificaciones",
    panelTitle: "Notificaciones",
    empty: "No hay notificaciones",
    markAllRead: "Marcar todas como leídas",
    more: "{{count}} más",
    badgeOverflow: "99+",
    errors: {
      loadFailed: "No se pudieron cargar las notificaciones",
      markAllFailed: "No se pudieron marcar todas como leídas",
    },
  },

  /** BrandProvider default branding (used only when no remote/prop override). */
  branding: {
    defaultName: "Aki",
    defaultDescription: "Evaluaciones internas y control de acceso",
  },

  /** ExamSettingsPage (candidate account settings) copy. */
  examSettings: {
    title: "Configuración de la cuenta",
  },

  pageMeta: {
    fallbackProductName: "Aki",
    fallbackPageTitle: "Página",
    static: {
      login: "Iniciar sesión",
      launchpad: "Configuración inicial",
      inviteAccept: "Activar cuenta",
      forgotPassword: "Recuperar contraseña",
      resetPassword: "Restablecer contraseña",
      dashboard: "Panel",
      users: "Gestión de usuarios",
      candidates: "Gestión de alumnos",
      settings: "Configuración de la plataforma",
      candidateFields: "Campos del alumno",
      courses: "Gestión de comisiones",
      questions: "Gestión de preguntas",
      questionsNew: "Nueva pregunta",
      questionsImport: "Importar preguntas",
      exams: "Gestión de exámenes",
      examsNew: "Nuevo examen",
      examProfiles: "Plantillas de reglas",
      examProfileNew: "Nueva plantilla de reglas",
      gradingQueue: "Por calificar",
      proctorWorkspace: "Mesa de supervisión",
      results: "Calificaciones",
      system: "Monitoreo del sistema",
      operations: "Resumen de operaciones",
      auditLogs: "Registro de auditoría",
      permissions: "Registro de permisos",
      importLogs: "Registro de importaciones",
      recovery: "Revisión de recuperación",
      proctorRecovery: "Resolución de supervisión",
      examList: "Mis exámenes",
      examSettings: "Configuración de la cuenta",
    },
    dynamic: {
      questionEdit: "Editar pregunta",
      examDetail: "Detalle del examen",
      examEdit: "Editar examen",
      examScores: "Lista de calificaciones",
      examProctor: "Supervisión",
      examMonitor: "Monitoreo del examen",
      examProfileEdit: "Editar plantilla de reglas",
      gradingDetail: "Calificación manual",
      attemptDetail: "Detalle del intento",
      recoveryIncident: "Detalle del incidente",
      recoveryAttempt: "Operaciones del intento",
      recoveryExam: "Recuperación del examen",
      proctorRecoveryIncident: "Detalle del incidente de supervisión",
      examPrepare: "Preparación del examen",
      examTake: "Examen en curso",
      examResult: "Resultado del examen",
    },
  },
} as const;

export default es;
