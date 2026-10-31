import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  LoginResponseSchema,
  ErrorResponseSchema,
  passwordLoginField,
} from "@exam/contracts";
import { hashPassword, verifyPassword } from "@exam/auth/password";
import { signJWT } from "@exam/auth/session";
import { createExamRepo } from "@exam/db/repository/examRepo";
import { createUserRepo } from "@exam/db/repository/userRepo";
import { createUserRoleAssignmentRepo } from "@exam/db/repository/userRoleAssignmentRepo";
import { createCandidateRepo } from "@exam/db/repository/candidateRepo";
import { createCandidateFieldRepo } from "@exam/db/repository/candidateFieldRepo";
import { createEnrollmentRepo } from "@exam/db/repository/enrollmentRepo";
import { executeInTransaction } from "@exam/db/types";
import type { RequestContext, Role, ExamStatus } from "@exam/domain";
import { loadAssignmentAuthority } from "../authz/assignmentAuthority.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { buildErrorResponse } from "../lib/errorResponse.js";
import { dispatchExamAssigned } from "../notifications/notificationService.js";

const tokenParams = z.object({ token: z.string().min(8).max(80) });
const legajoBody = z.object({
  legajo: z.string().trim().min(3).max(50),
});
const joinBody = legajoBody.extend({
  password: passwordLoginField(),
  name: z.string().trim().min(1).max(100).optional(),
});

function ctxFor(organizationId: string, actorId: string): RequestContext {
  return {
    actorId,
    organizationId,
    targetOrganizationId: organizationId,
    role: "Candidate",
    permissions: [],
    sessionId: "inscription",
  };
}

const INSCRIPTION_CLOSED_STATUSES = new Set<ExamStatus>([
  "closed",
  "canceled",
  "archived",
]);

function inscriptionExamUnavailable(
  exam: { status: ExamStatus } | null,
): "missing" | "closed" | "ok" {
  if (!exam) return "missing";
  if (INSCRIPTION_CLOSED_STATUSES.has(exam.status)) return "closed";
  return "ok";
}

const inscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/auth/inscriptions/:token",
    {
      schema: {
        params: tokenParams,
        response: {
          200: z.object({ title: z.string() }),
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = tokenParams.parse(request.params);
      const exam = await createExamRepo(fastify.db).findByInscriptionToken(
        token,
      );
      const availability = inscriptionExamUnavailable(exam);
      if (availability === "missing") {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      if (availability === "closed") {
        return reply
          .code(409)
          .send(buildErrorResponse(request.id, "EXAM_INSCRIPTION_CLOSED"));
      }
      return { title: exam!.title };
    },
  );

  fastify.post(
    "/auth/inscriptions/:token/lookup",
    {
      schema: {
        params: tokenParams,
        body: legajoBody,
        response: {
          200: z.object({ exists: z.boolean() }),
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = tokenParams.parse(request.params);
      const { legajo } = legajoBody.parse(request.body);
      const exam = await createExamRepo(fastify.db).findByInscriptionToken(
        token,
      );
      const availability = inscriptionExamUnavailable(exam);
      if (availability === "missing") {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      if (availability === "closed") {
        return reply
          .code(409)
          .send(buildErrorResponse(request.id, "EXAM_INSCRIPTION_CLOSED"));
      }
      const user = await createUserRepo(
        fastify.db,
      ).findByOrganizationAndUsername(
        ctxFor(exam!.organizationId, "inscription"),
        legajo,
      );
      return { exists: user != null };
    },
  );

  fastify.post(
    "/auth/inscriptions/:token",
    {
      schema: {
        params: tokenParams,
        body: joinBody,
        response: {
          200: LoginResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = tokenParams.parse(request.params);
      const { legajo, password, name } = joinBody.parse(request.body);
      const exam = await createExamRepo(fastify.db).findByInscriptionToken(
        token,
      );
      const availability = inscriptionExamUnavailable(exam);
      if (availability === "missing") {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      if (availability === "closed") {
        return reply
          .code(409)
          .send(buildErrorResponse(request.id, "EXAM_INSCRIPTION_CLOSED"));
      }
      const activeExam = exam!;
      const orgCtx = ctxFor(activeExam.organizationId, "inscription");
      const userRepo = createUserRepo(fastify.db);
      let user = await userRepo.findByOrganizationAndUsername(orgCtx, legajo);
      if (user) {
        const matches = await verifyPassword(password, user.passwordHash);
        if (!user.isActive || !matches) {
          return reply.code(400).send(
            buildErrorResponse(request.id, "VALIDATION_ERROR", {
              fields: [
                {
                  field: "password",
                  code: "INVALID",
                  message: "Contraseña incorrecta",
                },
              ],
            }),
          );
        }
      } else {
        if (password.length < 8) {
          return reply.code(400).send(
            buildErrorResponse(request.id, "VALIDATION_ERROR", {
              fields: [
                {
                  field: "password",
                  code: "TOO_SHORT",
                  message:
                    "La contraseña tiene que tener al menos 8 caracteres",
                },
              ],
            }),
          );
        }
        if (!name) {
          return reply.code(400).send(
            buildErrorResponse(request.id, "VALIDATION_ERROR", {
              fields: [
                {
                  field: "name",
                  code: "REQUIRED",
                  message: "Ingresá tu nombre completo",
                },
              ],
            }),
          );
        }
        const passwordHash = await hashPassword(password);
        const configured = await createCandidateFieldRepo(fastify.db).list(
          orgCtx,
        );
        const fields: Record<string, unknown> = {};
        for (const field of configured) {
          if (field.required || field.unique) fields[field.name] = legajo;
        }
        user = await executeInTransaction(fastify.db, async (tx) => {
          const createdUser = await createUserRepo(tx).createUnique(orgCtx, {
            username: legajo,
            passwordHash,
            name,
            role: "Candidate" as const,
            isActive: true,
            email: null,
          });
          const actorCtx = ctxFor(activeExam.organizationId, createdUser.id);
          await createUserRoleAssignmentRepo(tx).assignWithinTransaction(
            tx,
            actorCtx,
            {
              userId: createdUser.id,
              role: "Candidate",
              isPrimary: true,
              isActive: true,
            },
          );
          await createCandidateRepo(tx).create(actorCtx, {
            userId: createdUser.id,
            fields,
          });
          return createdUser;
        });
      }

      const actorCtx = ctxFor(activeExam.organizationId, user.id);
      const candidate = await createCandidateRepo(fastify.db).findByUserId(
        actorCtx,
        user.id,
      );
      if (!candidate) {
        return reply
          .code(400)
          .send(buildErrorResponse(request.id, "VALIDATION_ERROR"));
      }
      const enrollmentRepo = createEnrollmentRepo(fastify.db);
      const existing = await enrollmentRepo.listByExam(actorCtx, activeExam.id);
      if (!existing.some((row) => row.candidateId === candidate.id)) {
        const config = getRuntimeConfig();
        await executeInTransaction(fastify.db, async (tx) => {
          const created = await createEnrollmentRepo(tx).create(actorCtx, {
            examId: activeExam.id,
            candidateId: candidate.id,
            status: "assigned",
            attemptCount: 0,
          });
          await dispatchExamAssigned({
            db: tx,
            ctx: actorCtx,
            enrollmentId: created.id,
            examTitle: activeExam.title,
            recipientUserId: user.id,
            recipientEmail: user.email,
            publicWebOrigin: config.publicWebOrigin.origin,
            emailMaxAttempts: config.email.maxAttempts,
            now: fastify.now(),
          });
        });
      }

      const authority = await loadAssignmentAuthority(
        fastify.db,
        actorCtx,
        user.id,
      );
      if (!authority.ok) {
        return reply
          .code(401)
          .send(buildErrorResponse(request.id, "AUTH_INVALID_CREDENTIALS"));
      }
      const tokenJwt = signJWT(
        {
          actorId: user.id,
          role: authority.authority.primaryRole as Role,
          organizationId: user.organizationId,
          authEpoch: user.authEpoch,
        },
        getRuntimeConfig().authSecret.jwtSecret,
      );
      reply.setCookie("auth-token", tokenJwt, {
        httpOnly: true,
        secure: getRuntimeConfig().publicWebOrigin.isSecure,
        sameSite: "strict",
        maxAge: 24 * 60 * 60,
        path: "/",
      });
      return LoginResponseSchema.parse({
        id: user.id,
        username: user.username,
        name: user.name,
        role: authority.authority.primaryRole,
        organizationId: user.organizationId,
        capabilities: authority.authority.capabilities,
      });
    },
  );
};

export default inscriptionRoutes;
