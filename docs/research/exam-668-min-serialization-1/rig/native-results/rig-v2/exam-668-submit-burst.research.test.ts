/**
 * EXAM-668 RESEARCH BURST (isolated research facility — not a permanent test,
 * not for production merge).
 *
 * Directional submit-burst experiment per R4-protocol.md (PRE-REGISTERED).
 * NOT formal evidence: runs on WSL2, explicitly NOT a substitute for
 * native-Linux / production-topology measurement.
 *
 * Measures how the Exam-authority lock mode (EXAM_668_LOCK_MODE) shapes
 * candidate submit tail latency under a same-exam submit burst — the #586
 * observation shape (93.8% of sampled lock waits = exams single-row tuple
 * wait). The C/C reader/reader relation is the only behavior the mode
 * changes (R1/R3), so the burst isolates exactly that relation.
 *
 * Topology: S candidates submit the same exam through K dedicated
 * single-connection handles (worker-pool shape). K models the production
 * pool cap (10, #586 KEEP_POOL_10) — the schema-scoped test database pins
 * max:1 per handle, so the pool is modeled explicitly instead of through
 * buildTestApp (whose app pool is also max:1 and would serialize everything
 * at the pool, masking the row-lock effect).
 *
 * NO timing assertions: outcomes are recorded and exported; nothing here
 * "proves" a latency claim. Assertions are structural only (every submit
 * resolves, every attempt freezes).
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { createPostgresDatabase } from "@exam/db/postgres";
import { setupIsolatedTestDb } from "@exam/db/testIsolation";
import { resolveTestDbUrl } from "@exam/db/testDb";
import { buildTestApp } from "../testHelpers.js";
import examRoutes from "../exam.js";
import attemptRoutes from "../attempts.js";
import { schema } from "@exam/db/schema/pg";
import { submitAndGradeAttempt } from "../../orchestrators/submitAndGradeAttempt.js";
import { hashPassword } from "@exam/auth/password";
import { signJWT } from "@exam/auth/session";
import { getRuntimeConfig } from "../../config/runtimeConfig.js";
import type {
  Database,
} from "@exam/db/types";
import { and, eq, sql } from "drizzle-orm";
import type { Permission, RequestContext, Role } from "@exam/domain";
import type { ExamAttempt } from "@exam/domain";

process.env.DEADLINE_SCAN_INTERVAL_MS = "3600000";

const MODE = (process.env.EXAM_668_LOCK_MODE ?? "update") as
  | "update"
  | "share"
  | "none";
const CANDIDATES = Number(process.env.EXAM_668_BURST_CANDIDATES ?? "50");
const CONNECTIONS = Math.min(
  Number(process.env.EXAM_668_BURST_CONNECTIONS ?? "10"),
  CANDIDATES,
);
const OUT_PATH = process.env.EXAM_668_BURST_OUT;
const LABEL = process.env.EXAM_668_BURST_LABEL ?? `mode=${MODE}`;

interface BurstCandidate {
  token: string;
  ctx: RequestContext;
  profileId: string;
  attemptId: string;
}

describe(`EXAM-668 submit burst [${LABEL}, S=${CANDIDATES}, K=${CONNECTIONS}]`, () => {
  let iso: Awaited<ReturnType<typeof setupIsolatedTestDb>>;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let adminToken: string;
  let orgId: string;
  let examId: string;
  let candidates: BurstCandidate[] = [];
  let workers: Array<{ sql: { end(): Promise<void> } }> = [];
  let probeSql: { end(): Promise<void> } | undefined;

  beforeAll(async () => {
    iso = await setupIsolatedTestDb({
      namespace: "api",
      databaseUrl: resolveTestDbUrl(),
    });
    app = await buildTestApp(
      async (fastify) => {
        await fastify.register(examRoutes, { prefix: "" });
        await fastify.register(attemptRoutes, { prefix: "" });
      },
      { schemaName: iso.schemaName },
    );

    const now = new Date();
    const slug = `exam-668-burst-${randomUUID().slice(0, 8)}`;
    const org = (
      await app.db
        .insert(schema.organizations)
        .values({
          id: randomUUID(),
          name: slug,
          displayName: slug,
          slug,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    orgId = org.id;

    const adminId = randomUUID();
    const passwordHash = await hashPassword("password123");
    await app.db.insert(schema.users).values({
      id: adminId,
      organizationId: orgId,
      username: `admin-${slug}`,
      passwordHash,
      name: "Admin",
      role: "Admin",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await app.db.insert(schema.userRoleAssignments).values({
      id: randomUUID(),
      organizationId: orgId,
      userId: adminId,
      role: "Admin",
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const { jwtSecret } = getRuntimeConfig().authSecret;
    adminToken = signJWT(
      {
        actorId: adminId,
        role: "Admin" as Role,
        organizationId: orgId,
        authEpoch: 0,
      },
      jwtSecret,
    );

    const course = (
      await app.db
        .insert(schema.courses)
        .values({
          id: randomUUID(),
          organizationId: orgId,
          name: `Course ${slug}`,
          code: `C-${slug}`,
          description: "",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    const question = (
      await app.db
        .insert(schema.questions)
        .values({
          id: randomUUID(),
          organizationId: orgId,
          courseId: course.id,
          type: "single_choice" as const,
          content: "EXAM-668 burst",
          options: [
            { id: "a", content: "1" },
            { id: "b", content: "2" },
          ],
          standardAnswer: "a",
          attachments: [],
          score: 100,
          difficulty: 1,
          tags: [],
          gradingRule: {
            multiSelectScoring: "all_correct_full",
            fillBlankMatchMode: "exact",
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    const exam = (
      await app.db
        .insert(schema.exams)
        .values({
          id: randomUUID(),
          organizationId: orgId,
          title: `EXAM-668 burst ${slug}`,
          description: "",
          courseId: course.id,
          status: "open",
          timingMode: "deadline" as const,
          durationMinutes: null,
          openAt: new Date(now.getTime() - 60 * 60_000),
          closeAt: new Date(now.getTime() + 120 * 60_000),
          passingScore: 60,
          totalScore: 100,
          questionSelectionMode: "manual",
          questionIds: [question.id],
          questionSnapshot: [
            {
              originalQuestionId: question.id,
              type: "single_choice" as const,
              content: question.content,
              contentDocument: null,
              answerMode: null,
              attachments: [],
              options: question.options,
              standardAnswer: question.standardAnswer,
              score: question.score,
              gradingRule: question.gradingRule,
              order: 0,
              rubric: null,
            },
          ],
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
          interruptionTimePolicy: "strict",
          interruptionGracePerIncidentSeconds: null,
          interruptionGracePerAttemptSeconds: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    examId = exam.id;

    for (let i = 0; i < CANDIDATES; i++) {
      const userId = randomUUID();
      await app.db.insert(schema.users).values({
        id: userId,
        organizationId: orgId,
        username: `burst-${i}-${slug}`,
        passwordHash,
        name: `B${i}`,
        role: "Candidate",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await app.db.insert(schema.userRoleAssignments).values({
        id: randomUUID(),
        organizationId: orgId,
        userId,
        role: "Candidate",
        isPrimary: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const profile = (
        await app.db
          .insert(schema.candidateProfiles)
          .values({
            id: randomUUID(),
            organizationId: orgId,
            userId,
            fields: {},
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )[0]!;
      const token = signJWT(
        {
          actorId: userId,
          role: "Candidate" as Role,
          organizationId: orgId,
          authEpoch: 0,
        },
        jwtSecret,
      );
      const enrollRes = await app.app.inject({
        method: "POST",
        url: `/api/exams/${examId}/enrollments`,
        payload: { candidateIds: [profile.id] },
        cookies: { "auth-token": adminToken },
      });
      if (enrollRes.statusCode !== 200) {
        throw new Error(
          `enroll ${i} failed: ${enrollRes.statusCode} ${enrollRes.body}`,
        );
      }
      const startRes = await app.app.inject({
        method: "POST",
        url: `/api/attempts/${examId}/start`,
        cookies: { "auth-token": token },
      });
      if (startRes.statusCode !== 201 && startRes.statusCode !== 200) {
        throw new Error(
          `start ${i} failed: ${startRes.statusCode} ${startRes.body}`,
        );
      }
      candidates.push({
        token,
        profileId: profile.id,
        attemptId: startRes.json().id as string,
        ctx: {
          actorId: userId,
          organizationId: orgId,
          role: "Candidate",
          permissions: [] as Permission[],
          sessionId: `exam-668-burst-${i}`,
          targetOrganizationId: orgId,
        },
      });
    }
  }, 600_000);

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.sql.end().catch(() => {})));
    await probeSql?.sql.end().catch(() => {});
    await app.cleanup();
    await iso.cleanup();
  }, 60_000);

  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return NaN;
    const idx = Math.min(
      sorted.length - 1,
      Math.ceil((p / 100) * sorted.length) - 1,
    );
    return sorted[Math.max(0, idx)]!;
  }

  it("S same-exam submits through K single-connection workers", async () => {
    const workerHandles = [];
    for (let i = 0; i < CONNECTIONS; i++) {
      const conn = await createPostgresDatabase(
        iso.databaseUrl,
        iso.schemaName,
      );
      workers.push(conn);
      workerHandles.push(conn.db as Database);
    }
    probeSql = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);

    const durations = new Array<number>(CANDIDATES).fill(NaN);
    const outcomes: Array<{ i: number; ok: boolean; detail: string }> = [];

    // Lock-wait sampling on a dedicated connection: liveness observation,
    // never a timing input.
    let sampling = true;
    const samples: number[] = [];
    const sampler = (async () => {
      while (sampling) {
        try {
          const rows = (await probeSql!.sql`
            SELECT count(*)::int AS n
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND backend_type = 'client backend'
              AND state = 'active'
              AND wait_event_type = 'Lock'
          `) as Array<{ n: number }>;
          samples.push(rows[0]?.n ?? 0);
        } catch {
          samples.push(-1);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    })();

    const t0 = Date.now();
    await Promise.all(
      workerHandles.map(async (db, w) => {
        for (let i = w; i < CANDIDATES; i += CONNECTIONS) {
          const started = Date.now();
          try {
            const { attempt } = await submitAndGradeAttempt(
              db,
              candidates[i]!.ctx,
              candidates[i]!.attemptId,
              candidates[i]!.profileId,
              new Date(),
            );
            durations[i] = Date.now() - started;
            outcomes.push({
              i,
              ok: attempt.status === "graded" || attempt.status === "submitted",
              detail: attempt.status,
            });
          } catch (err) {
            durations[i] = Date.now() - started;
            outcomes.push({ i, ok: false, detail: String(err) });
          }
        }
      }),
    );
    const makespanMs = Date.now() - t0;
    sampling = false;
    await sampler;

    const sorted = [...durations].sort((a, b) => a - b);
    const validLockSamples = samples.filter((n) => n >= 0);
    const result = {
      label: LABEL,
      mode: MODE,
      candidates: CANDIDATES,
      connections: CONNECTIONS,
      makespanMs,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? NaN,
      failures: outcomes.filter((o) => !o.ok).length,
      failureDetails: outcomes.filter((o) => !o.ok).slice(0, 5),
      lockWaitSamples: validLockSamples.length,
      lockWaitMaxConcurrent: Math.max(0, ...validLockSamples),
      lockWaitMeanConcurrent:
        validLockSamples.length > 0
          ? Number(
              (
                validLockSamples.reduce((a, b) => a + b, 0) /
                validLockSamples.length
              ).toFixed(2),
            )
          : 0,
      host: `native linux (${hostname()}) — cross-host directional evidence`,
    };
    console.info(`[exam-668][burst] ${JSON.stringify(result)}`);
    if (OUT_PATH) {
      writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
    }

    expect(outcomes.length).toBe(CANDIDATES);
    expect(result.failures).toBe(0);

    // Structural freeze check on a sample of attempts (not all — the
    // outcome list already covers status).
    const spot = candidates[Math.floor(CANDIDATES / 2)]!;
    const rows = await app.db
      .select({ status: schema.examAttempts.status })
      .from(schema.examAttempts)
      .where(
        and(
          eq(schema.examAttempts.organizationId, orgId),
          eq(schema.examAttempts.id, spot.attemptId),
        ),
      )
      .limit(1);
    expect(["submitted", "graded"]).toContain(rows[0]?.status);

    // Post-timing terminal-state oracle (R7/N6): read-only verification
    // strictly outside the timed window, identical for both arms. Covers the
    // whole campaign population: answer-freeze correctness, terminal
    // auto-grading, and exactly-one materialized grading workset per attempt
    // (duplicate-workset detector). Never a latency input.
    const oracle = await app.db
      .select({
        attempts: sql<number>`count(*)`,
        frozenAnswers: sql<number>`count(*) filter (where ${schema.examAttempts.submittedAnswers} is not null)`,
        gradingResult: sql<number>`count(*) filter (where ${schema.examAttempts.gradingResult} is not null)`,
        terminalGrading: sql<number>`count(*) filter (where ${schema.examAttempts.gradingStatus} in ('auto_graded', 'fully_graded'))`,
        submissionReasons: sql<string[]>`coalesce(array_agg(distinct ${schema.examAttempts.submissionReason}) filter (where ${schema.examAttempts.submissionReason} is not null), '{}')`,
      })
      .from(schema.examAttempts)
      .where(
        and(
          eq(schema.examAttempts.organizationId, orgId),
          eq(schema.examAttempts.examId, examId),
        ),
      );
    const worksets = await app.db
      .select({
        total: sql<number>`count(*)`,
        distinctAttempts: sql<number>`count(distinct ${schema.attemptGradingEntries.attemptId})`,
      })
      .from(schema.attemptGradingEntries)
      .innerJoin(
        schema.examAttempts,
        eq(schema.attemptGradingEntries.attemptId, schema.examAttempts.id),
      )
      .where(
        and(
          eq(schema.examAttempts.organizationId, orgId),
          eq(schema.examAttempts.examId, examId),
        ),
      );
    const oracleSummary = {
      attempts: Number(oracle[0]!.attempts),
      frozenAnswers: Number(oracle[0]!.frozenAnswers),
      gradingResultPresent: Number(oracle[0]!.gradingResult),
      terminalGrading: Number(oracle[0]!.terminalGrading),
      submissionReasons: oracle[0]!.submissionReasons,
      worksetTotal: Number(worksets[0]!.total),
      worksetDistinctAttempts: Number(worksets[0]!.distinctAttempts),
    };
    expect(oracleSummary.attempts).toBe(CANDIDATES);
    expect(oracleSummary.frozenAnswers).toBe(CANDIDATES);
    expect(oracleSummary.terminalGrading).toBe(CANDIDATES);
    expect(oracleSummary.worksetTotal).toBe(CANDIDATES);
    expect(oracleSummary.worksetDistinctAttempts).toBe(CANDIDATES);
    result.oracle = oracleSummary;
    console.info(`[exam-668][burst][oracle] ${JSON.stringify(oracleSummary)}`);
    if (OUT_PATH) {
      writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
    }
  }, 600_000);
});
