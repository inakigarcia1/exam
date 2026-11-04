import { z } from "zod";
import { isManualGradedQuestion, plainTextProjection } from "@exam/domain";
import { AnswerModeEnum, ContentSlotSchema } from "./contentDocument.js";
import type { AnswerMode, ContentSlot } from "./contentDocument.js";

// ── Question ──────────────────────────────────────────────────────

/** Every question type. The single wire list; other schemas reuse it. */
export const QuestionTypeEnum = z.enum([
  "single_choice",
  "multiple_choice",
  "fill_blank",
  "true_false",
  "text_response",
  "likert",
  "ranking",
]);

/**
 * Likert column labels, left to right. `options` are the rows; a likert
 * standardAnswer maps every row id to the index of its correct column.
 */
export const LikertScaleSchema = z
  .array(z.string().trim().min(1).max(100))
  .min(2)
  .max(10);

/**
 * A stored option. `contentDocument == null` → Plain (content authoritative);
 * non-null → Rich (document authoritative, `content` is the server-derived
 * plain-text projection — never a client-trusted second authority).
 */
const OptionSchema = z.object({
  id: z.string(),
  content: z.string(),
  contentDocument: ContentSlotSchema,
  isCorrect: z.boolean().optional(),
});

/**
 * Write-side option: when a rich document is present the server derives
 * `content` from it, so the client is not required to send a projection.
 */
const OptionInputSchema = OptionSchema.extend({
  content: z.string().optional(),
});

/** Largest accepted question image upload, in bytes (ADR-024). */
export const QUESTION_IMAGE_MAX_BYTES = 1024 * 1024;

/** Content hash of a stored question image: lowercase hex SHA-256. */
export const QuestionImageSha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * A question's single image: a reference to an immutable `question_images`
 * row of the same organization, plus its alternative text (ADR-024).
 */
export const QuestionImageSchema = z.object({
  sha256: QuestionImageSha256Schema,
  alt: z.string().max(300),
});

/** Response of `POST /question-images`. */
export const QuestionImageUploadResponseSchema = z.object({
  sha256: QuestionImageSha256Schema,
});

/**
 * Question score write rule (#438): strictly positive AND finite.
 * `z.number().positive()` alone accepts Infinity because zod's number
 * checks are comparison-based, and the JSON wire can deliver it via an
 * overflowing exponent token (`1e999` parses to Infinity) that the
 * `double precision` column would persist verbatim — so every supported
 * write boundary must reject non-finite. No upper bound is imposed here:
 * an arbitrary maximum is product policy, not this numeric invariant.
 */
export const QuestionScoreSchema = z.number().positive().finite();

/**
 * Schema for a question's grading rule, configuring multi-select scoring mode,
 * fill-blank matching mode, and case sensitivity.
 */
export const GradingRuleSchema = z.object({
  multiSelectScoring: z.enum(["all_correct_full", "partial_half"]),
  fillBlankMatchMode: z.enum(["exact", "keyword"]),
  fillBlankCaseSensitive: z.boolean().optional(),
});

/**
 * Schema for a question's standard answer.
 *
 * Grading mode is a property of the question TYPE: `text_response` is
 * manually graded and its standardAnswer is an optional reference answer
 * (null is legal); every other type is auto-graded and requires a non-null,
 * correctly-typed standardAnswer. Null is accepted at this scalar level so
 * text_response can carry a reference-answer-less row; the type-aware
 * cross-field rule in {@link validateQuestionType} rejects null for
 * auto-graded types, reusing the canonical manual-grading predicate
 * `isManualGradedQuestion`.
 */
const StandardAnswerSchema = z
  .unknown()
  .refine((value) => value !== undefined, {
    message: "standardAnswer is required",
  });

/**
 * Internal validation function that enforces type-specific constraints on questions.
 * Validates option uniqueness, minimum option count for choice questions, standardAnswer
 * format per type, and fill-blank placeholder requirements.
 *
 * #301 additions: fill_blank is Plain-only (hard rule), rich slots must carry
 * a non-empty projection, plain slots require content, and `answerMode` is
 * only meaningful for text_response.
 */
function validateQuestionType(
  question: {
    type: z.infer<typeof QuestionTypeEnum>;
    content?: string | undefined;
    contentDocument?: ContentSlot;
    answerMode?: AnswerMode | null | undefined;
    scale?: string[] | null | undefined;
    options?:
      | Array<{
          id: string;
          content?: string | undefined;
          contentDocument?: ContentSlot;
          isCorrect?: boolean | undefined;
        }>
      | undefined;
    standardAnswer: unknown;
  },
  ctx: z.RefinementCtx,
) {
  // #301 §16 HARD RULE: fill_blank's `____` syntax simultaneously drives
  // display, blank count, key generation, and grading keys. Rich content
  // would break that coupling, so it is rejected outright (Structured
  // fill_blank is a separate follow-up).
  if (question.type === "fill_blank" && question.contentDocument != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fill_blank questions do not support rich content",
      path: ["contentDocument"],
    });
  }

  if (
    question.answerMode !== undefined &&
    question.answerMode !== null &&
    question.type !== "text_response"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "answerMode is only meaningful for text_response questions",
      path: ["answerMode"],
    });
  }

  if (question.contentDocument != null) {
    // Rich write: the document is the authority; the server derives the
    // projection. A rich question with an empty projection is meaningless.
    if (plainTextProjection(question.contentDocument).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rich question content must not be empty",
        path: ["contentDocument"],
      });
    }
  } else if (question.content === undefined || question.content.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "content is required",
      path: ["content"],
    });
  }

  const options = question.options ?? [];
  const optionIds = options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "option ids must be unique",
      path: ["options"],
    });
  }

  for (const [index, option] of options.entries()) {
    if (option.contentDocument == null && option.content === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "plain option requires content",
        path: ["options", index, "content"],
      });
    }
  }

  if (
    (question.type === "single_choice" ||
      question.type === "multiple_choice" ||
      question.type === "likert" ||
      question.type === "ranking") &&
    (!question.options || question.options.length < 2)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "choice questions require at least two options",
      path: ["options"],
    });
  }

  const scale = question.scale ?? null;
  if (question.type === "likert" && scale === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "likert questions require a scale",
      path: ["scale"],
    });
  }
  if (question.type !== "likert" && scale !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scale is only meaningful for likert questions",
      path: ["scale"],
    });
  }

  if (
    question.type === "fill_blank" &&
    question.content !== undefined &&
    !question.content.includes("____")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fill blank questions require a ____ placeholder",
      path: ["content"],
    });
  }

  // Null standardAnswer is legal ONLY for text_response (its reference
  // answer is optional); every auto-graded type requires a non-null typed
  // answer here — the write boundary must not create a question that the
  // publish guard would later reject. Reuses isManualGradedQuestion so the
  // grading-mode authority stays single-sourced.
  if (question.standardAnswer == null) {
    if (!isManualGradedQuestion({ type: question.type })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auto-graded questions require a standardAnswer",
        path: ["standardAnswer"],
      });
    }
    return;
  }

  if (
    question.type === "single_choice" &&
    (typeof question.standardAnswer !== "string" ||
      !optionIds.includes(question.standardAnswer))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "single choice standardAnswer must reference an option",
      path: ["standardAnswer"],
    });
  }

  if (
    question.type === "multiple_choice" &&
    (!Array.isArray(question.standardAnswer) ||
      question.standardAnswer.length === 0 ||
      question.standardAnswer.some(
        (answer) => typeof answer !== "string" || !optionIds.includes(answer),
      ))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "multiple choice standardAnswer must reference options",
      path: ["standardAnswer"],
    });
  }

  if (
    question.type === "true_false" &&
    typeof question.standardAnswer !== "boolean"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "true/false questions require a boolean standardAnswer",
      path: ["standardAnswer"],
    });
  }

  if (
    question.type === "fill_blank" &&
    (typeof question.standardAnswer !== "string" ||
      question.standardAnswer.trim() === "")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fill blank questions require a non-empty standardAnswer",
      path: ["standardAnswer"],
    });
  }

  if (question.type === "likert" && scale !== null) {
    const answer = question.standardAnswer;
    const valid =
      typeof answer === "object" &&
      !Array.isArray(answer) &&
      Object.keys(answer as object).length === optionIds.length &&
      optionIds.every((id) => {
        const column = (answer as Record<string, unknown>)[id];
        return (
          Number.isInteger(column) &&
          (column as number) >= 0 &&
          (column as number) < scale.length
        );
      });
    if (!valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "likert standardAnswer must map every row to a column of the scale",
        path: ["standardAnswer"],
      });
    }
  }

  if (
    question.type === "ranking" &&
    !isPermutationOf(question.standardAnswer, optionIds)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ranking standardAnswer must order every option exactly once",
      path: ["standardAnswer"],
    });
  }
}

/** True when `value` lists every id of `ids` exactly once. */
export function isPermutationOf(value: unknown, ids: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === ids.length &&
    new Set(value).size === ids.length &&
    value.every((id) => typeof id === "string" && ids.includes(id))
  );
}

/**
 * Schema for a question entity in the question bank, including content, options,
 * standard answer, image, scoring, difficulty, tags, and grading rules.
 *
 * `contentDocument` carries the B′ dual-mode authority: null → Plain
 * (content authoritative), non-null → Rich (document authoritative, content
 * is the server-derived plain-text projection). `answerMode` (plain/rich) is
 * the author-defined answer input mode — only set for text_response.
 */
export const QuestionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: QuestionTypeEnum,
  content: z.string(),
  contentDocument: ContentSlotSchema,
  answerMode: AnswerModeEnum.nullable().default(null),
  options: z.array(OptionSchema),
  standardAnswer: StandardAnswerSchema,
  image: QuestionImageSchema.nullable(),
  scale: z.array(z.string()).nullable(),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  gradingRule: GradingRuleSchema,
  // Rubric dual-layer: authoring/editing source on the live row.
  // text_response requires non-empty at publish; objective questions carry null.
  rubric: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Represents a question entity with all metadata, content, and grading configuration. */
export type QuestionDTO = z.infer<typeof QuestionSchema>;

/**
 * Canonical tag grammar (issue #182): a stored tag is a non-empty string,
 * trimmed, and free of commas — because GET /questions?tags= round-trips tags
 * through a comma-separated wire format (`a,b` split + trim), so a tag with a
 * comma or padding could never round-trip back through the structured filter.
 * This schema is the single authoritative write gate: it trims, drops empty
 * values, dedupes (first occurrence wins), and REJECTS comma-containing tags
 * rather than silently altering them.
 */
export const QuestionTagsSchema = z
  .array(z.string())
  .superRefine((tags, ctx) => {
    for (const [index, tag] of tags.entries()) {
      if (tag.includes(",")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message:
            "tag must not contain a comma (tags travel on a comma-separated wire format)",
        });
      }
    }
  })
  .transform((tags) => {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const tag of tags) {
      const trimmed = tag.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  });

/**
 * Request schema for creating a new question, with type-specific validation
 * enforced via superRefine (option counts, standardAnswer format, etc.).
 *
 * Content modes (#301): send `content` for Plain (default) or
 * `contentDocument` for Rich — a rich write's `content`, if sent, is ignored
 * because the server derives the projection from the document.
 */
export const CreateQuestionRequestSchema = z
  .object({
    type: QuestionTypeEnum,
    content: z.string().optional(),
    contentDocument: ContentSlotSchema,
    answerMode: AnswerModeEnum.nullable().optional(),
    options: z.array(OptionInputSchema).optional(),
    standardAnswer: StandardAnswerSchema,
    image: QuestionImageSchema.nullable().default(null),
    scale: LikertScaleSchema.nullable().default(null),
    difficulty: z.number().int().min(1).max(5).default(3),
    tags: QuestionTagsSchema.default([]),
    gradingRule: GradingRuleSchema.default({
      multiSelectScoring: "all_correct_full",
      fillBlankMatchMode: "exact",
    }),
    rubric: z.string().nullable().default(null),
  })
  .superRefine(validateQuestionType);

/** Type for a create-question request. */
export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequestSchema>;

/**
 * Partial-data cross-field rules for question updates. Type-dependent rules
 * only fire when `type` is present in the payload; the route re-checks the
 * type-dependent rules against the stored question when only one side of the
 * pair is being updated.
 */
function validateQuestionUpdate(
  question: {
    type?: z.infer<typeof QuestionTypeEnum> | undefined;
    contentDocument?: ContentSlot;
    answerMode?: AnswerMode | null | undefined;
    options?: Array<z.infer<typeof OptionInputSchema>> | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (question.type === "fill_blank" && question.contentDocument != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fill_blank questions do not support rich content",
      path: ["contentDocument"],
    });
  }

  if (
    question.answerMode !== undefined &&
    question.answerMode !== null &&
    question.type !== undefined &&
    question.type !== "text_response"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "answerMode is only meaningful for text_response questions",
      path: ["answerMode"],
    });
  }

  if (
    question.contentDocument != null &&
    plainTextProjection(question.contentDocument).trim() === ""
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rich question content must not be empty",
      path: ["contentDocument"],
    });
  }

  for (const [index, option] of (question.options ?? []).entries()) {
    if (option.contentDocument == null && option.content === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "plain option requires content",
        path: ["options", index, "content"],
      });
    }
  }
}

/**
 * Update semantics for the content slots (#301):
 *   contentDocument undefined → mode unchanged; null → clear to Plain;
 *   document → set Rich (content is re-derived server-side).
 * `answerMode` is only meaningful for text_response. Cross-field rules that
 * need the stored row (e.g. switching a rich question to fill_blank without
 * clearing the document) are enforced by the route against the live question.
 */
export const UpdateQuestionRequestSchema = z
  .object({
    type: QuestionTypeEnum.optional(),
    content: z.string().min(1).optional(),
    contentDocument: ContentSlotSchema,
    answerMode: AnswerModeEnum.nullable().optional(),
    options: z.array(OptionInputSchema).optional(),
    standardAnswer: StandardAnswerSchema.optional(),
    image: QuestionImageSchema.nullable().optional(),
    scale: LikertScaleSchema.nullable().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    tags: QuestionTagsSchema.optional(),
    gradingRule: GradingRuleSchema.optional(),
    rubric: z.string().nullable().optional(),
  })
  .superRefine(validateQuestionUpdate);

/** Type for an update-question request. */
export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequestSchema>;

// ── Question Import ───────────────────────────────────────────────

/**
 * Request schema for batch-importing questions. Each row is one CSV record
 * keyed by `QUESTION_CSV_HEADER`; the route maps it with
 * `questionFromCsvRecord` and validates it with CreateQuestionRequestSchema.
 */
export const QuestionImportRequestSchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
  confirm: z.boolean().default(false),
});

/** Type for a question import request. */
export type QuestionImportRequest = z.infer<typeof QuestionImportRequestSchema>;

/**
 * Response schema for a question import result, summarizing valid, warning, and error counts
 * with per-row detail messages.
 */
export const QuestionImportResultSchema = z.object({
  total: z.number().int(),
  valid: z.number().int(),
  warnings: z.number().int(),
  errors: z.number().int(),
  details: z.array(
    z.object({
      row: z.number().int(),
      status: z.enum(["valid", "warning", "error"]),
      message: z
        .string()
        .optional()
        .describe(
          "Compatibility human text, non-authoritative. A failing row joins multiple Zod issue messages, so no single stable machine code exists per row; per-row code enrichment was evaluated and deferred by the message-remediation program (#417, C2 verdict).",
        ),
    }),
  ),
  logId: z.string().uuid().optional(),
});

/** Type for a question import result. */
export type QuestionImportResult = z.infer<typeof QuestionImportResultSchema>;
