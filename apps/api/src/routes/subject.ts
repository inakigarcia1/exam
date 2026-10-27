import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Permission } from "@exam/authz";
import { createSubjectRepo } from "@exam/db/repository/subjectRepo";
import { ensureTargetOrg, getRequestContext } from "./helpers.js";
import { buildErrorResponse } from "../lib/errorResponse.js";

const cookieAuth = [{ cookieAuth: [] }] as const;

const subjectRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = () => createSubjectRepo(fastify.db);

  fastify.get(
    "/subjects",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.CourseView),
      ],
      schema: { security: cookieAuth },
    },
    async (request) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const items = await repo().list(ctx);
      return {
        items: items.map((row) => ({
          id: row.id,
          name: row.name,
        })),
        total: items.length,
      };
    },
  );

  fastify.post(
    "/subjects",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.CourseCreate),
      ],
      schema: { security: cookieAuth },
    },
    async (request, reply) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const body = z
        .object({ name: z.string().min(1).max(200) })
        .parse(request.body);
      const created = await repo().create(ctx, {
        name: body.name.trim(),
      });
      return reply.code(201).send({ id: created.id, name: created.name });
    },
  );

  fastify.patch(
    "/subjects/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.CourseUpdate),
      ],
      schema: { security: cookieAuth },
    },
    async (request, reply) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { id } = request.params as { id: string };
      const body = z
        .object({ name: z.string().min(1).max(200) })
        .parse(request.body);
      const updated = await repo().update(ctx, id, { name: body.name.trim() });
      if (!updated) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return { id: updated.id, name: updated.name };
    },
  );

  fastify.delete(
    "/subjects/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.CourseDelete),
      ],
      schema: { security: cookieAuth },
    },
    async (request, reply) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const { id } = request.params as { id: string };
      const ok = await repo().delete(ctx, id);
      if (!ok) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return reply.code(204).send();
    },
  );
};

export default subjectRoutes;
