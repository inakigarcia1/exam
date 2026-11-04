import { createHash, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { QUESTION_IMAGE_MAX_BYTES } from "@exam/contracts";
import { schema } from "@exam/db/schema/pg";
import { buildTestApp, uniquePrefix } from "./testHelpers.js";
import courseRoutes from "./course.js";
import questionRoutes from "./question.js";
import questionImageRoutes from "./questionImages.js";
import examRoutes from "./exam.js";
import attemptRoutes from "./attempts.js";
import {
  buildExamPayload,
  enrollCandidateForExam,
  ensureCandidateProfile,
} from "./attempts/__tests__/attempts.testHelpers.js";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function fakePng(): Buffer {
  return Buffer.concat([PNG_SIGNATURE, randomBytes(64)]);
}

function fakeWebp(): Buffer {
  const body = randomBytes(32);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length + 4);
  return Buffer.concat([Buffer.from("RIFF"), size, Buffer.from("WEBP"), body]);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("question images", () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let courseId: string;
  let candidateProfileId: string;

  beforeAll(async () => {
    ctx = await buildTestApp(async (fastify) => {
      await fastify.register(courseRoutes);
      await fastify.register(questionRoutes);
      await fastify.register(questionImageRoutes);
      await fastify.register(examRoutes);
      await fastify.register(attemptRoutes);
    });
    const courseRes = await ctx.app.inject({
      method: "POST",
      url: "/api/courses",
      payload: {
        name: "Image Course",
        code: `IMG-${uniquePrefix()}`,
        description: "",
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    courseId = courseRes.json().id;
    candidateProfileId = await ensureCandidateProfile(ctx);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  async function upload(
    bytes: Buffer,
    contentType = "image/png",
    token = ctx.adminToken,
  ) {
    return ctx.app.inject({
      method: "POST",
      url: "/api/question-images",
      payload: bytes,
      headers: { "content-type": contentType },
      cookies: { "auth-token": token },
    });
  }

  it("stores an image once per content hash and serves it back", async () => {
    const bytes = fakePng();
    const first = await upload(bytes);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ sha256: sha256(bytes) });

    const second = await upload(bytes);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual({ sha256: sha256(bytes) });

    const rows = await ctx.db.select().from(schema.questionImages);
    expect(rows.filter((r) => r.sha256 === sha256(bytes))).toHaveLength(1);

    const get = await ctx.app.inject({
      method: "GET",
      url: `/api/question-images/${sha256(bytes)}`,
      cookies: { "auth-token": ctx.candidateToken },
    });
    expect(get.statusCode).toBe(200);
    expect(get.headers["content-type"]).toBe("image/png");
    expect(get.headers["cache-control"]).toBe(
      "private, max-age=31536000, immutable",
    );
    expect(get.headers["etag"]).toBe(`"${sha256(bytes)}"`);
    expect(get.rawPayload.equals(bytes)).toBe(true);
  });

  it("detects the format from magic bytes, not from the declared content type", async () => {
    const bytes = fakeWebp();
    const res = await upload(bytes, "image/png");
    expect(res.statusCode).toBe(201);
    const get = await ctx.app.inject({
      method: "GET",
      url: `/api/question-images/${res.json().sha256}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(get.headers["content-type"]).toBe("image/webp");
  });

  it("rejects bytes that are not PNG, JPEG or WebP (SVG included)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const res = await upload(svg, "image/png");
    expect(res.statusCode).toBe(400);
  });

  it("rejects an image larger than the size limit", async () => {
    const big = Buffer.concat([
      PNG_SIGNATURE,
      Buffer.alloc(QUESTION_IMAGE_MAX_BYTES),
    ]);
    const res = await upload(big);
    expect(res.statusCode).toBe(413);
  });

  it("rejects an upload from an actor without question.create", async () => {
    const res = await upload(fakePng(), "image/png", ctx.candidateToken);
    expect(res.statusCode).toBe(403);
  });

  it("does not serve another organization's image", async () => {
    const otherOrgId = randomUUID();
    const now = new Date();
    await ctx.db.insert(schema.organizations).values({
      id: otherOrgId,
      name: `other-${otherOrgId.slice(0, 8)}`,
      displayName: "Other",
      slug: `other-${otherOrgId.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    });
    const bytes = fakePng();
    await ctx.db.insert(schema.questionImages).values({
      organizationId: otherOrgId,
      sha256: sha256(bytes),
      mimeType: "image/png",
      bytes,
      sizeBytes: bytes.length,
    });
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/question-images/${sha256(bytes)}`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a question that references an image not uploaded to the organization", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "Sin imagen subida",
        standardAnswer: true,
        image: { sha256: sha256(randomBytes(8)), alt: "" },
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(res.statusCode).toBe(400);
  });

  it("freezes the image in the attempt snapshot and exposes it in the take view", async () => {
    const original = fakePng();
    const originalSha = (await upload(original)).json().sha256 as string;

    const qRes = await ctx.app.inject({
      method: "POST",
      url: "/api/questions",
      payload: {
        type: "true_false",
        content: "Mirá la figura",
        standardAnswer: true,
        image: { sha256: originalSha, alt: "Un triángulo" },
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(qRes.statusCode).toBe(201);
    expect(qRes.json().image).toEqual({
      sha256: originalSha,
      alt: "Un triángulo",
    });
    const questionId = qRes.json().id as string;

    const examRes = await ctx.app.inject({
      method: "POST",
      url: "/api/exams",
      payload: {
        ...buildExamPayload({
          title: `Image Exam ${uniquePrefix()}`,
          courseId,
          questionIds: [questionId],
        }),
        questionScores: { [questionId]: 100 },
      },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(examRes.statusCode).toBe(201);
    const examId = examRes.json().id as string;
    const pubRes = await ctx.app.inject({
      method: "POST",
      url: `/api/exams/${examId}/publish`,
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(pubRes.statusCode, pubRes.body).toBe(200);
    await enrollCandidateForExam(ctx, candidateProfileId, examId);

    const replacementSha = (await upload(fakePng())).json().sha256 as string;
    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${questionId}`,
      payload: { image: { sha256: replacementSha, alt: "Otra" } },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().image.sha256).toBe(replacementSha);

    const start = await ctx.app.inject({
      method: "POST",
      url: `/api/attempts/${examId}/start`,
      cookies: { "auth-token": ctx.candidateToken },
    });
    expect(start.statusCode).toBe(201);
    const attemptId = start.json().id as string;
    expect(start.json().questionSnapshot[0].image).toEqual({
      sha256: originalSha,
      alt: "Un triángulo",
    });

    const take = await ctx.app.inject({
      method: "GET",
      url: `/api/candidate/attempts/${attemptId}/take`,
      cookies: { "auth-token": ctx.candidateToken },
    });
    expect(take.statusCode).toBe(200);
    expect(take.json().questions[0].image).toEqual({
      sha256: originalSha,
      alt: "Un triángulo",
    });

    const removeRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/questions/${questionId}`,
      payload: { image: null },
      cookies: { "auth-token": ctx.adminToken },
    });
    expect(removeRes.statusCode).toBe(200);
    expect(removeRes.json().image).toBeNull();
  });
});
