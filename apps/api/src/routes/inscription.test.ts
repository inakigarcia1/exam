import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { ExamStatus } from "@exam/domain";
import { schema } from "@exam/db/schema/pg";
import inscriptionRoutes from "./inscription.js";
import { buildTestApp, uniquePrefix } from "./testHelpers.js";

describe("inscription link on a finished exam", () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let courseId: string;

  async function insertExam(status: ExamStatus): Promise<{
    examId: string;
    token: string;
  }> {
    const now = new Date();
    const examId = randomUUID();
    const token = `insc${randomUUID().replace(/-/g, "")}`;
    await ctx.db.insert(schema.exams).values({
      id: examId,
      organizationId: ctx.org.id,
      title: `Inscription ${status}`,
      description: "",
      courseId,
      inscriptionToken: token,
      status,
      timingMode: "timed_window",
      durationMinutes: 60,
      openAt: new Date(now.getTime() - 2 * 86400_000),
      closeAt: new Date(now.getTime() - 86400_000),
      passingScore: 60,
      totalScore: 100,
      questionSelectionMode: "manual",
      questionIds: [],
      questionSnapshot: [],
      controlFlags: {
        shuffleQuestions: false,
        shuffleOptions: false,
        detectTabSwitch: false,
        disableCopyPaste: false,
        requireQueue: false,
        batchSize: 10,
        batchInterval: 3,
        restrictIp: false,
        requireLockdown: false,
        showResultImmediately: true,
      },
      retakePolicy: "unlimited",
      scoreStrategy: "highest",
      maxAttempts: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { examId, token };
  }

  beforeAll(async () => {
    ctx = await buildTestApp(inscriptionRoutes);
    const now = new Date();
    courseId = randomUUID();
    await ctx.db.insert(schema.courses).values({
      id: courseId,
      organizationId: ctx.org.id,
      name: "Inscription course",
      code: `INS-${uniquePrefix()}`,
      description: "",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("unknown token still answers 404", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/auth/inscriptions/${randomUUID().replace(/-/g, "")}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it.each(["closed", "canceled", "archived"] as const)(
    "%s exam: GET, lookup and join answer 409 EXAM_INSCRIPTION_CLOSED and create no enrollment",
    async (status) => {
      const { examId, token } = await insertExam(status);
      const legajo = `L${uniquePrefix()}`.slice(0, 40);

      const get = await ctx.app.inject({
        method: "GET",
        url: `/api/auth/inscriptions/${token}`,
      });
      const lookup = await ctx.app.inject({
        method: "POST",
        url: `/api/auth/inscriptions/${token}/lookup`,
        payload: { legajo },
      });
      const join = await ctx.app.inject({
        method: "POST",
        url: `/api/auth/inscriptions/${token}`,
        payload: { legajo, password: "secreto-123", name: "Alumno Cerrado" },
      });

      for (const res of [get, lookup, join]) {
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe("EXAM_INSCRIPTION_CLOSED");
      }
      const enrollments = await ctx.db
        .select()
        .from(schema.examEnrollments)
        .where(eq(schema.examEnrollments.examId, examId));
      expect(enrollments).toHaveLength(0);
      const users = await ctx.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, legajo));
      expect(users).toHaveLength(0);
    },
  );
});
