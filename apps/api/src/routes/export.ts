import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ErrorResponseSchema } from "@exam/contracts";
import { createAttemptRepo } from "@exam/db/repository/attemptRepo";
import { createExamRepo } from "@exam/db/repository/examRepo";
import { createCandidateFieldRepo } from "@exam/db/repository/candidateFieldRepo";
import { ensureTargetOrg, getRequestContext } from "./helpers.js";
import { generateCSV } from "@exam/import-export";
import { Permission } from "@exam/authz";
import { buildErrorResponse } from "../lib/errorResponse.js";
import { recordSensitiveReadAudit } from "../audit/auditWriter.js";

/**
 * Zod schema for route parameters that expect a UUID `id`.
 */
const idParamsSchema = z.object({ id: z.string().uuid() });

/** OpenAPI security definition for cookie-based authentication. */
const cookieAuth = [{ cookieAuth: [] }] as const;

/**
 * Fastify plugin that registers the data export routes.
 */
export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /exams/:id/export/scores
   *
   * Exports graded attempt scores for the specified exam as a CSV file.
   * Admin-only. The CSV includes candidate name, custom fields, score,
   * pass status, attempt number, and submission time.
   */
  fastify.get(
    "/exams/:id/export/scores",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.ScoreExport),
      ],
      schema: {
        params: idParamsSchema,
        security: cookieAuth,
        "x-role": ["Admin"],
        response: {
          200: z.string(),
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: examId } = request.params as { id: string };
      const ctx = ensureTargetOrg(getRequestContext(request));

      const examRepo = createExamRepo(fastify.db);
      const exam = await examRepo.findById(ctx, examId);
      if (!exam) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }

      const attemptRepo = createAttemptRepo(fastify.db);
      // ADR-005: canceled exams never export.
      if (exam.status === "canceled") {
        return reply
          .code(409)
          .send(
            buildErrorResponse(
              request.id,
              "EXAM_CANCELED_RESULTS_UNAVAILABLE",
              { reason: "CANCELLATION_MARKER_NOT_IMPLEMENTED" },
            ),
          );
      }
      // ADR-005 close & export policy: do not export while unresolved attempts
      // remain, so an admin cannot export partial results mid-exam.
      const unresolvedCount = await attemptRepo.countUnresolvedByExam(
        ctx,
        examId,
      );
      if (unresolvedCount > 0) {
        return reply.code(409).send(
          buildErrorResponse(request.id, "RESOURCE_CONFLICT", {
            reason: "UNRESOLVED_ATTEMPTS_EXIST",
            activeAttemptCount: unresolvedCount,
          }),
        );
      }
      const results = await attemptRepo.listGradedByExam(ctx, examId);

      const candidateFieldRepo = createCandidateFieldRepo(fastify.db);
      const fields = (await candidateFieldRepo.list(ctx)).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const fieldPairs = fields.map((f) => ({
        key: f.name,
        label: f.label || f.name,
      }));

      const headers = [
        // i18n-copy-allow: data-format — CSV export header/value data contract
        "Nombre del alumno",
        ...fieldPairs.map((fp) => fp.label),
        // i18n-copy-allow: data-format — CSV export header/value data contract
        "Calificaciones",
        // i18n-copy-allow: data-format — CSV export header/value data contract
        "Aprobado o no",
        // i18n-copy-allow: data-format — CSV export header/value data contract
        "Intentos",
        // i18n-copy-allow: data-format — CSV export header/value data contract
        "Fecha de entrega",
      ];

      // i18n-copy-allow: data-format — CSV export header/value data contract
      const passedLabel = "Aprobado";
      // i18n-copy-allow: data-format — CSV export header/value data contract
      const notPassedLabel = "No aprobado";

      const rows = results.map((r) => ({
        "Nombre del alumno": r.candidateUser.name,
        ...fieldPairs.reduce(
          (acc, fp) => {
            acc[fp.label] = r.candidateProfile.fields[fp.key] ?? "";
            return acc;
          },
          {} as Record<string, unknown>,
        ),
        Calificaciones: r.attempt.score,
        "Aprobado o no": r.attempt.passed ? passedLabel : notPassedLabel,
        Intentos: r.attempt.attemptNo,
        "Fecha de entrega": r.attempt.submittedAt?.toISOString() ?? "",
      }));

      const csv = "\uFEFF" + generateCSV(headers, rows);

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header(
        "Content-Disposition",
        `attachment; filename="scores-${examId}-${Date.now()}.csv"`,
      );

      await recordSensitiveReadAudit(fastify.db, request, ctx, {
        action: "export_scores",
        targetType: "exam",
        targetId: examId,
        metadata: { format: "csv", rowCount: results.length },
      });

      return reply.send(csv);
    },
  );
};
