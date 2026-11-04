import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ErrorResponseSchema,
  QUESTION_IMAGE_MAX_BYTES,
  QuestionImageSha256Schema,
  QuestionImageUploadResponseSchema,
} from "@exam/contracts";
import { Permission } from "@exam/authz";
import {
  createQuestionImageRepo,
  type QuestionImageMimeType,
} from "@exam/db/repository/questionImageRepo";
import { ensureTargetOrg, getRequestContext } from "./helpers.js";
import { buildErrorResponse } from "../lib/errorResponse.js";

const cookieAuth = [{ cookieAuth: [] }] as const;

const ACCEPTED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Identifies the format from the file signature. The declared Content-Type is
 * client-controlled and never trusted; anything else (SVG included) is null.
 */
export function sniffImageMimeType(
  bytes: Buffer,
): QuestionImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Upload and serve question images (ADR-024). */
const questionImageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser(
    ACCEPTED_CONTENT_TYPES,
    { parseAs: "buffer", bodyLimit: QUESTION_IMAGE_MAX_BYTES },
    (_req, body, done) => done(null, body),
  );

  fastify.post(
    "/question-images",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireCapability(Permission.QuestionCreate),
      ],
      schema: {
        consumes: ACCEPTED_CONTENT_TYPES,
        security: cookieAuth,
        "x-role": ["Admin", "Teacher"],
        response: {
          201: QuestionImageUploadResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    /** Store a PNG/JPEG/WebP image (raw body) and return its content hash. Idempotent per organization. */
    async (request: any, reply: any) => {
      const ctx = ensureTargetOrg(getRequestContext(request));
      const bytes = request.body;
      const mimeType = Buffer.isBuffer(bytes)
        ? sniffImageMimeType(bytes)
        : null;
      if (!mimeType) {
        return reply
          .code(400)
          .send(buildErrorResponse(request.id, "VALIDATION_ERROR"));
      }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      await createQuestionImageRepo(fastify.db).put(ctx, {
        sha256,
        mimeType,
        bytes,
      });
      return reply.code(201).send({ sha256 });
    },
  );

  fastify.get(
    "/question-images/:sha256",
    {
      // INTENTIONAL: authenticate-only. Candidates render these images while
      // taking an exam; the hash only reaches clients through responses they
      // were already authorized to read and cannot be guessed (ADR-024).
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ sha256: QuestionImageSha256Schema }),
        security: cookieAuth,
        response: { 404: ErrorResponseSchema },
      },
    },
    /** Serve an image of the actor's organization by content hash. Immutable, so cacheable forever. */
    async (request: any, reply: any) => {
      const ctx = getRequestContext(request);
      const { sha256 } = request.params as { sha256: string };
      const image = await createQuestionImageRepo(fastify.db).find(ctx, sha256);
      if (!image) {
        return reply
          .code(404)
          .send(buildErrorResponse(request.id, "RESOURCE_NOT_FOUND"));
      }
      return reply
        .type(image.mimeType)
        .header("Cache-Control", "private, max-age=31536000, immutable")
        .header("ETag", `"${sha256}"`)
        .header("X-Content-Type-Options", "nosniff")
        .send(image.bytes);
    },
  );
};

export default questionImageRoutes;
