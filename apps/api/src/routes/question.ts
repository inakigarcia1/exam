import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { QuestionImage, RequestContext } from "@exam/domain";
import {
  CreateQuestionRequestSchema,
  QuestionImportRequestSchema,
  UpdateQuestionRequestSchema,
  PaginationParamsSchema,
  QuestionSchema,
  QuestionImportResultSchema,
  ErrorResponseSchema,
  QUESTION_CSV_HEADER,
  questionFromCsvRecord,
  questionToCsvRecord,
} from "@exam/contracts";
import { generateCSV } from "@exam/import-export";
import { createQuestionRepo } from "@exam/db/repository/questionRepo";
import { createQuestionImageRepo } from "@exam/db/repository/questionImageRepo";
import { createImportJobLogRepo } from "@exam/db/repository/importJobLogRepo";
import { executeInTransaction } from "@exam/db/types";
import { Permission } from "@exam/authz";
import {
  ensureTargetOrg,
  getRequestContext,
  resolveImportStatus,
} from "./helpers.js";
import {
  assertRichContentUpdateAllowed,
  resolveQuestionContentWrite,
} from "./questionContent.js";
import { recordBestEffortAudit } from "../audit/auditWriter.js";
import {
  buildErrorResponse,
  buildValidationErrorResponse,
} from "../lib/errorResponse.js";

/** Zod schema for route params containing a UUID `id`. */
const idParamsSchema = z.object({ id: z.string().uuid() });

/** OpenAPI security scheme: HTTP-only cookie authentication. */
const cookieAuth = [{ cookieAuth: [] }] as const;

/** Zod schema for the paginated question list response. */
const questionListResponseSchema = z.object({
  items: z.array(QuestionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

/** Zod schema for query parameters when listing questions. */
const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  difficulty: z.coerce.number().int().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
});

/** Zod schema for the distinct tag vocabulary response (issue #182 tag filter). */
const questionTagListResponseSchema = z.object({
  tags: z.array(z.string()),
});

type QuestionRow = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createQuestionRepo>["findById"]>>
>;

function toQuestionResponse(question: QuestionRow) {
  return {
    id: question.id,
    organizationId: question.organizationId,
    type: question.type,
    content: question.content,
    contentDocument: question.contentDocument ?? null,
    answerMode: question.answerMode ?? null,
    options: question.options,
    standardAnswer: question.standardAnswer,
    image: question.image ?? null,
    scale: question.scale ?? null,
    difficulty: question.difficulty,
    tags: question.tags,
    gradingRule: question.gradingRule,
    rubric: question.rubric,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/**
 * A referenced image must already be uploaded to the actor's organization.
 * The `questions_image_fk` constraint enforces the same rule; this check turns
 * a violation into a 400 instead of a database error.
 */
async function imageBelongsToOrg(
  fastify: FastifyInstance,
  ctx: RequestContext,
  image: QuestionImage | null | undefined,
): Promise<boolean> {
  if (!image) return true;
  return createQuestionImageRepo(fastify.db).exists(ctx, image.sha256);
}

/** Fastify plugin that registers all question CRUD and import routes. */
const questionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/questions",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionView),
      ],
      schema: {
        querystring: questionListQuerySchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          200: questionListResponseSchema,
        },
      },
    },
    /** List questions with pagination and optional filters (type, difficulty, tags) and server-side content search. Scoped to the actor's organization. */
    async (request: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { page, pageSize } = PaginationParamsSchema.parse(request.query);
      const query = request.query as Record<string, string | undefined>;
      const repo = createQuestionRepo(fastify.db);

      const filters: {
        type?: string;
        difficulty?: number;
        tags?: string[];
        search?: string;
      } = {};
      if (query.type) filters.type = query.type;
      if (query.difficulty) filters.difficulty = Number(query.difficulty);
      if (query.tags) {
        filters.tags = query.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
      if (query.search) filters.search = query.search;

      const { items, total } = await repo.listFiltered(ctx, filters, {
        page,
        pageSize,
      });

      return {
        items: items.map((q) => toQuestionResponse(q)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );

  fastify.get(
    "/questions/tags",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionView),
      ],
      schema: {
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          200: questionTagListResponseSchema,
        },
      },
    },
    /** Returns the distinct sorted tag vocabulary (issue #182 tag filter) for the organization. */
    async (request: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const repo = createQuestionRepo(fastify.db);
      const tags = await repo.listAllTags(ctx);
      return { tags };
    },
  );

  fastify.get(
    "/questions/export",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionView),
      ],
      schema: {
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: { 200: z.string() },
      },
    },
    /** Export the whole question bank as CSV in the import format (`QUESTION_CSV_HEADER`). */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const questions = await createQuestionRepo(fastify.db).list(ctx);
      const rows = questions.map((q) =>
        questionToCsvRecord({
          type: q.type,
          content: q.content,
          options: q.options,
          standardAnswer: q.standardAnswer,
          scale: q.scale ?? null,
          rubric: q.rubric,
          difficulty: q.difficulty,
          tags: q.tags,
        }),
      );
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header(
        "Content-Disposition",
        'attachment; filename="preguntas.csv"',
      );
      return reply.send("\uFEFF" + generateCSV([...QUESTION_CSV_HEADER], rows));
    },
  );

  fastify.get(
    "/questions/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionView),
      ],
      schema: {
        params: idParamsSchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          200: QuestionSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    /** Get a single question by ID. Returns 404 if not found. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { id } = request.params as { id: string };
      const repo = createQuestionRepo(fastify.db);
      const question = await repo.findById(ctx, id);
      if (!question) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return toQuestionResponse(question);
    },
  );

  fastify.post(
    "/questions",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionCreate),
      ],
      schema: {
        body: CreateQuestionRequestSchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          201: QuestionSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    /** Create a new question in the organization question bank. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const parsed = CreateQuestionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(buildValidationErrorResponse(request.id, parsed.error));
      }
      const data = parsed.data;
      if (!(await imageBelongsToOrg(fastify, ctx, data.image))) {
        return reply
          .code(400)
          .send(buildErrorResponse(request.id, "VALIDATION_ERROR"));
      }

      const resolved = resolveQuestionContentWrite({
        type: data.type,
        content: data.content,
        contentDocument: data.contentDocument,
        answerMode: data.answerMode,
        options: data.options,
      });

      const question = await createQuestionRepo(fastify.db).create(ctx, {
        type: data.type,
        content: resolved.content,
        contentDocument: resolved.contentDocument,
        answerMode: resolved.answerMode,
        options: resolved.options,
        standardAnswer: data.standardAnswer,
        image: data.image,
        scale: data.scale,
        difficulty: data.difficulty,
        tags: data.tags,
        gradingRule: data.gradingRule,
        rubric: data.rubric,
      });
      recordBestEffortAudit(fastify, request, ctx, {
        action: "question.create",
        targetType: "question",
        targetId: question.id,
      });

      return reply.code(201).send(toQuestionResponse(question));
    },
  );

  fastify.patch(
    "/questions/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionUpdate),
      ],
      schema: {
        params: idParamsSchema,
        body: UpdateQuestionRequestSchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          200: QuestionSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    /** Update an existing question by ID. Returns 404 if not found, 400 on validation error. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { id } = request.params as { id: string };
      const data = UpdateQuestionRequestSchema.parse(request.body);
      const repo = createQuestionRepo(fastify.db);
      const existing = await repo.findById(ctx, id);
      if (!existing) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      const validated = CreateQuestionRequestSchema.parse({
        ...existing,
        ...data,
      });
      assertRichContentUpdateAllowed({
        storedDocument: existing.contentDocument ?? null,
        updateContent: data.content,
        updateDocument: data.contentDocument,
      });
      if (!(await imageBelongsToOrg(fastify, ctx, data.image))) {
        return reply
          .code(400)
          .send(buildErrorResponse(request.id, "VALIDATION_ERROR"));
      }
      const resolved = resolveQuestionContentWrite({
        type: validated.type,
        content: validated.content,
        contentDocument: validated.contentDocument,
        answerMode: validated.answerMode,
        options: validated.options,
      });
      const updated = await createQuestionRepo(fastify.db).update(ctx, id, {
        type: validated.type,
        content: resolved.content,
        contentDocument: resolved.contentDocument,
        answerMode: resolved.answerMode,
        options: resolved.options,
        standardAnswer: validated.standardAnswer,
        image: validated.image,
        scale: validated.scale,
        difficulty: validated.difficulty,
        tags: validated.tags,
        gradingRule: validated.gradingRule,
        rubric: validated.rubric,
      });
      if (updated) {
        recordBestEffortAudit(fastify, request, ctx, {
          action: "question.update",
          targetType: "question",
          targetId: id,
          metadata: { changedFields: Object.keys(data) },
        });
      }
      if (!updated) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return toQuestionResponse(updated);
    },
  );

  fastify.delete(
    "/questions/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionDelete),
      ],
      schema: {
        params: idParamsSchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          204: z.null(),
          404: ErrorResponseSchema,
        },
      },
    },
    /** Delete a question by ID. Returns 404 if not found. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { id } = request.params as { id: string };
      const deleted = await createQuestionRepo(fastify.db).delete(ctx, id);
      if (deleted) {
        recordBestEffortAudit(fastify, request, ctx, {
          action: "question.delete",
          targetType: "question",
          targetId: id,
        });
      }
      if (!deleted) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return reply.code(204).send();
    },
  );

  fastify.post(
    "/questions/import",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionImport),
      ],
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: {
        body: QuestionImportRequestSchema,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          200: QuestionImportResultSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    /** Import questions in bulk from CSV-like rows. Validates each row; creates questions only when confirm=true. Rate-limited to 5 requests per minute. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const parsed = QuestionImportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(buildValidationErrorResponse(request.id, parsed.error));
      }
      const body = parsed.data;

      const processRows = async (
        repo: ReturnType<typeof createQuestionRepo>,
      ) => {
        const details: Array<{
          row: number;
          status: "valid" | "warning" | "error";
          message?: string;
        }> = [];
        let valid = 0;
        const warnings = 0;
        let errors = 0;

        for (let i = 0; i < body.rows.length; i++) {
          const raw = body.rows[i];
          if (!raw) continue;
          const parsedRow = CreateQuestionRequestSchema.safeParse(
            questionFromCsvRecord(raw),
          );

          if (!parsedRow.success) {
            errors++;
            details.push({
              row: i + 1,
              status: "error",
              message: parsedRow.error.issues
                .map((issue) => issue.message)
                .join("; "),
            });
            continue;
          }

          const data = parsedRow.data;
          if (body.confirm) {
            const resolved = resolveQuestionContentWrite({
              type: data.type,
              content: data.content,
              contentDocument: null,
              answerMode: null,
              options: data.options,
            });
            await repo.create(ctx, {
              type: data.type,
              content: resolved.content,
              contentDocument: resolved.contentDocument,
              answerMode: resolved.answerMode,
              options: resolved.options,
              standardAnswer: data.standardAnswer,
              image: null,
              scale: data.scale,
              difficulty: data.difficulty,
              tags: data.tags,
              gradingRule: data.gradingRule,
              rubric: data.rubric,
            });
          }
          valid++;
          details.push({ row: i + 1, status: "valid" });
        }
        return { details, valid, warnings, errors };
      };

      const processed = body.confirm
        ? await executeInTransaction(fastify.db, async (tx) => {
            return processRows(createQuestionRepo(tx));
          })
        : await processRows(createQuestionRepo(fastify.db));
      const { details, valid, warnings, errors } = processed;

      if (body.confirm) {
        recordBestEffortAudit(fastify, request, ctx, {
          action: "question.import",
          targetType: "question",
          targetId: ctx.organizationId,
          metadata: { total: body.rows.length, valid, errors },
        });
      }

      if (body.confirm) {
        const questionLogStatus = resolveImportStatus({
          errors,
          affectedCount: valid,
        });
        let logId: string | undefined;
        try {
          const questionLog = await createImportJobLogRepo(fastify.db).create(
            ctx,
            {
              type: "question",
              status: questionLogStatus,
              total: body.rows.length,
              createdCount: valid,
              updatedCount: 0,
              errors,
              metadata: { warnings },
              errorsDetail:
                errors > 0
                  ? details
                      .filter((d) => d.status === "error")
                      .map((d) => ({
                        row: d.row,
                        code: "VALIDATION_ERROR",
                        message: d.message ?? "",
                      }))
                  : null,
            },
          );
          logId = questionLog.id;
        } catch (logError) {
          fastify.log.error(
            { err: logError, type: "question", status: questionLogStatus },
            "Failed to persist question import log; import result is unchanged",
          );
        }
        return reply.code(200).send({
          total: body.rows.length,
          valid,
          warnings,
          errors,
          details,
          ...(logId ? { logId } : {}),
        });
      }
      return reply.code(200).send({
        total: body.rows.length,
        valid,
        warnings,
        errors,
        details,
      });
    },
  );
};

export default questionRoutes;
