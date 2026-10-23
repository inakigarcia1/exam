/**
 * EXAM-668 RESEARCH PROBE (isolated research facility — not a permanent test,
 * not for production merge).
 *
 * Deterministic correctness experiments for the minimum serialization
 * contract of candidate take/save/submit deadline decisions. Runs the SAME
 * schedules under three Exam-authority lock modes selected by
 * `EXAM_668_LOCK_MODE`:
 *
 *   update (default) — canonical #558/#560 mechanism (FOR UPDATE)
 *   share            — #667 candidate mechanism (deadline readers FOR SHARE,
 *                      writers/scanner/operator keep FOR UPDATE)
 *   none             — counterfactual negative control (plain MVCC read; the
 *                      pre-#558 defect shape; MUST fail the writer-first tests)
 *
 * Harness discipline (inherited from the #560/#543 concurrency suites): no
 * sleeps gate any outcome — interleavings are forced by deferred park points
 * inside transaction compositions and by an enrollment row-lock barrier;
 * waiting is OBSERVED via pg_stat_activity / pg_blocking_pids and pg_locks
 * with hard deadlines that fail loudly. Blocker polls are liveness predicates
 * with bounded deadlines, never timing assumptions.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { createPostgresDatabase } from "@exam/db/postgres";
import { setupIsolatedTestDb } from "@exam/db/testIsolation";
import { resolveTestDbUrl } from "@exam/db/testDb";
import { buildTestApp } from "../testHelpers.js";
import examRoutes from "../exam.js";
import attemptRoutes from "../attempts.js";
import { schema } from "@exam/db/schema/pg";
import { createAttemptRepo } from "@exam/db/repository/attemptRepo";
import { createExamRepo } from "@exam/db/repository/examRepo";
import { createEnrollmentRepo } from "@exam/db/repository/enrollmentRepo";
import { createCandidateRepo } from "@exam/db/repository/candidateRepo";
import { createAttemptGradingEntryRepo } from "@exam/db/repository/attemptGradingEntryRepo";
import { createAttemptInterruptionRepo } from "@exam/db/repository/attemptInterruptionRepo";
import { createAttemptInterruptionEventRepo } from "@exam/db/repository/attemptInterruptionEventRepo";
import {
  ensureAttemptDeadlineReconciled,
  lockEnrollmentAndAttempt,
  prepareReconciledAttemptMutation,
  saveAnswer,
} from "@exam/exam-engine";
import type { SubmitInterruptionResolution } from "@exam/exam-engine";
import { autoSubmitAndGrade } from "../../plugins/deadlineScanner.js";
import { submitAndGradeAttempt } from "../../orchestrators/submitAndGradeAttempt.js";
import {
  createExamEngineRepos,
  createGradingWorksetRepoAdapter,
  createInterruptionEpisodeRepoAdapter,
  createInterruptionEventRepoAdapter,
} from "../../adapters/repoAdapters.js";
import { validateAnswerForQuestion } from "../../lib/validateAnswerForQuestion.js";
import { hashPassword } from "@exam/auth/password";
import { signJWT } from "@exam/auth/session";
import { getRuntimeConfig } from "../../config/runtimeConfig.js";
import type { Permission, RequestContext, Role } from "@exam/domain";
import { NotFoundError } from "@exam/domain";
import type { Database } from "@exam/db/types";
import { executeInTransaction } from "@exam/db/types";
import { createDeferred, type Deferred } from "../../testing/barrier.js";
import type { ExamAttempt } from "@exam/domain";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { SYSTEM_ACTOR_IDS, createSystemRequestContext } from "@exam/authz";

process.env.DEADLINE_SCAN_INTERVAL_MS = "3600000";

const MODE = (process.env.EXAM_668_LOCK_MODE ?? "update") as
  | "update"
  | "share"
  | "none";

const MINUTE_MS = 60_000;
const BLOCKER_POLL_DEADLINE_MS = 8_000;

async function teardownAll(
  ...steps: Array<() => Promise<unknown>>
): Promise<void> {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `teardown failed with ${errors.length} error(s): ` +
        errors.map((e) => String(e)).join(" | "),
    );
  }
}

interface CandidateIdentity {
  userId: string;
  profileId: string;
  token: string;
  ctx: RequestContext;
}

interface ExamFixture {
  orgId: string;
  examId: string;
  questionId: string;
  closeAt: Date;
  candidates: Record<"a" | "b", CandidateIdentity>;
  attemptIds: Record<"a" | "b", string>;
}

interface FixtureHarness {
  iso: Awaited<ReturnType<typeof setupIsolatedTestDb>>;
  ctx: Awaited<ReturnType<typeof buildTestApp>>;
  db1: Database;
  sql1: { end(): Promise<void> };
  adminToken: string;
  orgId: string;
}

async function setupHarness(): Promise<FixtureHarness> {
  const testDbUrl = resolveTestDbUrl();
  const iso = await setupIsolatedTestDb({
    namespace: "api",
    databaseUrl: testDbUrl,
  });
  const ctx = await buildTestApp(
    async (fastify) => {
      await fastify.register(examRoutes, { prefix: "" });
      await fastify.register(attemptRoutes, { prefix: "" });
    },
    { schemaName: iso.schemaName },
  );
  const conn1 = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);

  const now = new Date();
  const slug = `exam-668-admin-${randomUUID().slice(0, 8)}`;
  const org = (
    await ctx.db
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
  const adminId = randomUUID();
  const passwordHash = await hashPassword("password123");
  await ctx.db.insert(schema.users).values({
    id: adminId,
    organizationId: org.id,
    username: `admin-${slug}`,
    passwordHash,
    name: "Admin",
    role: "Admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert(schema.userRoleAssignments).values({
    id: randomUUID(),
    organizationId: org.id,
    userId: adminId,
    role: "Admin",
    isPrimary: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const { jwtSecret } = getRuntimeConfig().authSecret;
  const adminToken = signJWT(
    {
      actorId: adminId,
      role: "Admin" as Role,
      organizationId: org.id,
      authEpoch: 0,
    },
    jwtSecret,
  );
  return { iso, ctx, db1: conn1.db, sql1: conn1.sql, adminToken, orgId: org.id };
}

async function setupExamFixture(
  h: FixtureHarness,
  closeAt: Date,
): Promise<ExamFixture> {
  const now = new Date();
  const slug = `exam-668-${randomUUID().slice(0, 8)}`;
  const db = h.ctx.db;

  const orgId = h.orgId;

  const course = (
    await db
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
    await db
      .insert(schema.questions)
      .values({
        id: randomUUID(),
        organizationId: orgId,
        courseId: course.id,
        type: "single_choice" as const,
        content: "EXAM-668",
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

  // timingMode "deadline": attempt deadlineAt = null → effective deadline IS
  // exam.closeAt — an exact oracle for which authority each pass evaluated.
  const exam = (
    await db
      .insert(schema.exams)
      .values({
        id: randomUUID(),
        organizationId: orgId,
        title: `EXAM-668 ${slug}`,
        description: "",
        courseId: course.id,
        status: "open",
        timingMode: "deadline" as const,
        durationMinutes: null,
        openAt: new Date(now.getTime() - 60 * MINUTE_MS),
        closeAt,
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
        maxAttempts: 10,
        interruptionTimePolicy: "strict",
        interruptionGracePerIncidentSeconds: null,
        interruptionGracePerAttemptSeconds: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
  )[0]!;

  const candidates = {} as Record<"a" | "b", CandidateIdentity>;
  const attemptIds = {} as Record<"a" | "b", string>;
  const { jwtSecret } = getRuntimeConfig().authSecret;

  for (const role of ["a", "b"] as const) {
    const userId = randomUUID();
    const username = `cand-${role}-${slug}`;
    await db.insert(schema.users).values({
      id: userId,
      organizationId: orgId,
      username,
      passwordHash: await hashPassword("password123"),
      name: role.toUpperCase(),
      role: "Candidate",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.userRoleAssignments).values({
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
      await db
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
    const ctx: RequestContext = {
      actorId: userId,
      organizationId: orgId,
      role: "Candidate",
      permissions: [] as Permission[],
      sessionId: `exam-668-${role}`,
      targetOrganizationId: orgId,
    };
    candidates[role] = { userId, profileId: profile.id, token, ctx };

    const enrollRes = await h.ctx.app.inject({
      method: "POST",
      url: `/api/exams/${exam.id}/enrollments`,
      payload: { candidateIds: [profile.id] },
      cookies: { "auth-token": h.adminToken },
    });
    if (enrollRes.statusCode !== 200) {
      throw new Error(
        `enroll failed: ${enrollRes.statusCode} ${enrollRes.body}`,
      );
    }
    const startRes = await h.ctx.app.inject({
      method: "POST",
      url: `/api/attempts/${exam.id}/start`,
      cookies: { "auth-token": token },
    });
    if (startRes.statusCode !== 201) {
      throw new Error(`start failed: ${startRes.statusCode} ${startRes.body}`);
    }
    attemptIds[role] = startRes.json().id as string;
  }

  return {
    orgId: orgId,
    examId: exam.id,
    questionId: question.id,
    closeAt,
    candidates,
    attemptIds,
  };
}

/**
 * The take route's production transaction composition, with a backend-pid
 * capture and deterministic parks:
 *   - "beforeReconciliation": parked holding Enrollment FU + Attempt FU; the
 *     RR snapshot is fixed but the Exam authority is not yet touched.
 *   - "afterReconciliation": parked holding Enrollment → Attempt → Exam.
 * `passCount` records composition executions (whole-tx 40001 retry re-entry);
 * `observedStatuses` records each surviving pass's reconciliation outcome.
 */
async function runParkedTakeComposition(args: {
  h: FixtureHarness;
  fixture: ExamFixture;
  role: "a" | "b";
  now: Date;
  park?: {
    beforeReconciliation?: Deferred<void>;
    beforeReconciliationWait?: Deferred<void>;
    afterReconciliation?: Deferred<void>;
    afterReconciliationWait?: Deferred<void>;
  };
  passCount?: number[];
  observedStatuses?: string[];
  capturedPid?: number[];
}): Promise<ExamAttempt> {
  const {
    h,
    fixture,
    role,
    now,
    park,
    passCount,
    observedStatuses,
    capturedPid,
  } = args;
  const ctx = fixture.candidates[role].ctx;

  return executeInTransaction(h.db1, async (tx) => {
    passCount?.push(1);
    const { exams, enrollments, attempts } = createExamEngineRepos(
      {
        examRepo: createExamRepo(tx),
        attemptRepo: createAttemptRepo(tx),
        enrollmentRepo: createEnrollmentRepo(tx),
      },
      ctx,
    );
    const cap = await lockEnrollmentAndAttempt(
      enrollments,
      attempts,
      fixture.attemptIds[role],
    );

    if (capturedPid) {
      const pidResult = (await tx.execute(
        drizzleSql`SELECT pg_backend_pid() AS pid`,
      )) as unknown;
      const pidRows =
        (pidResult as { rows?: Array<{ pid: number }> }).rows ??
        (pidResult as Array<{ pid: number }>);
      capturedPid.push(Number(pidRows[0]!.pid));
    }

    const preRead = await attempts.findById(fixture.attemptIds[role]);
    const episodeRepo = createInterruptionEpisodeRepoAdapter(
      createAttemptInterruptionRepo(tx),
      ctx,
    );
    const eventRepo = createInterruptionEventRepoAdapter(
      createAttemptInterruptionEventRepo(tx),
      ctx,
    );
    const resolution: SubmitInterruptionResolution =
      preRead?.status === "disrupted"
        ? {
            mode: "active_interruption",
            episodeRepo,
            eventRepo,
            hint: {
              policy:
                preRead.interruptionTimingPolicySnapshot?.policy ?? "strict",
              eligibleSeconds: null,
              adjustmentId: null,
              reasonCode: "deadline_terminalization",
            },
          }
        : { mode: "none", episodeRepo, eventRepo };

    if (park?.beforeReconciliation) {
      park.beforeReconciliation.resolve();
      await park.beforeReconciliationWait!.promise;
    }

    const reconciled = await ensureAttemptDeadlineReconciled(
      exams,
      enrollments,
      attempts,
      createGradingWorksetRepoAdapter(createAttemptGradingEntryRepo(tx), ctx),
      cap,
      now,
      resolution,
    );
    observedStatuses?.push(reconciled.status);

    if (park?.afterReconciliation) {
      park.afterReconciliation.resolve();
      await park.afterReconciliationWait!.promise;
    }

    if (reconciled.candidateId !== fixture.candidates[role].profileId) {
      throw new NotFoundError("Attempt not found");
    }
    return reconciled;
  });
}

/**
 * The save route's production transaction composition (post-preparation
 * park), with backend-pid capture. Mirrors
 * candidate-save-deadline-race.concurrency.test.ts.
 */
async function runParkedSaveComposition(args: {
  h: FixtureHarness;
  fixture: ExamFixture;
  now: Date;
  park: {
    afterPreparation: Deferred<void>;
    afterPreparationWait: Deferred<void>;
  };
  capturedPid?: number[];
}): Promise<Awaited<ReturnType<typeof saveAnswer>>> {
  const { h, fixture, now, park, capturedPid } = args;
  const ctx = fixture.candidates.a.ctx;

  return executeInTransaction(h.db1, async (tx) => {
    const txRepo = createAttemptRepo(tx);
    const candidateProfile = await createCandidateRepo(tx).findByUserId(
      ctx,
      ctx.actorId,
    );
    if (!candidateProfile) {
      throw new NotFoundError("candidate profile missing");
    }

    const { exams, enrollments, attempts } = createExamEngineRepos(
      {
        examRepo: createExamRepo(tx),
        attemptRepo: txRepo,
        enrollmentRepo: createEnrollmentRepo(tx),
      },
      ctx,
    );
    const cap = await lockEnrollmentAndAttempt(
      enrollments,
      attempts,
      fixture.attemptIds.a,
    );

    if (capturedPid) {
      const pidResult = (await tx.execute(
        drizzleSql`SELECT pg_backend_pid() AS pid`,
      )) as unknown;
      const pidRows =
        (pidResult as { rows?: Array<{ pid: number }> }).rows ??
        (pidResult as Array<{ pid: number }>);
      capturedPid.push(Number(pidRows[0]!.pid));
    }

    const preAttempt = await attempts.findById(fixture.attemptIds.a);
    const episodeRepo = createInterruptionEpisodeRepoAdapter(
      createAttemptInterruptionRepo(tx),
      ctx,
    );
    const eventRepo = createInterruptionEventRepoAdapter(
      createAttemptInterruptionEventRepo(tx),
      ctx,
    );
    const resolution: SubmitInterruptionResolution =
      preAttempt?.status === "disrupted"
        ? {
            mode: "active_interruption",
            episodeRepo,
            eventRepo,
            hint: {
              policy:
                preAttempt.interruptionTimingPolicySnapshot?.policy ??
                "strict",
              eligibleSeconds: null,
              adjustmentId: null,
              reasonCode: "deadline_terminalization",
            },
          }
        : { mode: "none", episodeRepo, eventRepo };

    const { attempt: currentAttempt, mutationContext } =
      await prepareReconciledAttemptMutation(
        exams,
        enrollments,
        attempts,
        createGradingWorksetRepoAdapter(createAttemptGradingEntryRepo(tx), ctx),
        cap,
        now,
        resolution,
      );

    park.afterPreparation.resolve();
    await park.afterPreparationWait.promise;

    if (currentAttempt.candidateId !== candidateProfile.id) {
      throw new NotFoundError("attempt not owned by candidate");
    }

    return saveAnswer(
      attempts,
      mutationContext,
      {
        attemptId: fixture.attemptIds.a,
        questionId: fixture.questionId,
        answer: "a",
        clientSeq: 1,
        clientSavedAt: now.toISOString(),
        baseVersion: 0,
      },
      validateAnswerForQuestion,
    );
  });
}

function createPark(): { reached: Deferred<void>; wait: Deferred<void> } {
  return {
    reached: createDeferred<void>("park reached"),
    wait: createDeferred<void>("park release"),
  };
}

/** Mark a promise's settlement without changing its result. */
function withSettleFlag<T>(
  p: Promise<T>,
  flag: { settled: boolean },
): Promise<T> {
  return p.then(
    (v) => {
      flag.settled = true;
      return v;
    },
    (e) => {
      flag.settled = true;
      throw e;
    },
  );
}

/**
 * Liveness predicate with a hard deadline: poll pg_stat_activity until some
 * client backend is lock-waiting with `holderPid` among its blockers. A miss
 * fails LOUDLY — never degrades into a timing assumption.
 */
async function observeBlockerOn(
  iso: { databaseUrl: string; schemaName: string },
  holderPid: number,
): Promise<number> {
  const connProbe = await createPostgresDatabase(
    iso.databaseUrl,
    iso.schemaName,
  );
  try {
    const deadline = Date.now() + BLOCKER_POLL_DEADLINE_MS;
    for (;;) {
      const waiters = (await connProbe.sql`
        SELECT pid, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND backend_type = 'client backend'
          AND wait_event_type = 'Lock'
      `) as Array<{ pid: number; blockers: number[] }>;
      const match = waiters.find(
        (w) =>
          Array.isArray(w.blockers) &&
          w.blockers.map(Number).includes(holderPid),
      );
      if (match) return Number(match.pid);
      if (Date.now() > deadline) {
        throw new Error(
          `no lock waiter blocked on holder pid ${holderPid} within ` +
            `${BLOCKER_POLL_DEADLINE_MS}ms (waiters seen: ` +
            `${JSON.stringify(waiters)})`,
        );
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  } finally {
    await connProbe.sql.end();
  }
}

async function readAttemptRow(
  h: FixtureHarness,
  attemptId: string,
): Promise<ExamAttempt> {
  const rows = await h.ctx.db
    .select()
    .from(schema.examAttempts)
    .where(eq(schema.examAttempts.id, attemptId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("attempt row missing");
  return row as unknown as ExamAttempt;
}

async function readExamCloseAt(
  h: FixtureHarness,
  examId: string,
): Promise<Date | null> {
  const row = (
    await h.ctx.db
      .select({ closeAt: schema.exams.closeAt })
      .from(schema.exams)
      .where(eq(schema.exams.id, examId))
      .limit(1)
  )[0];
  if (!row) throw new NotFoundError("exam row missing");
  return row.closeAt;
}

async function extendExam(
  h: FixtureHarness,
  examId: string,
  extendMinutes: number,
): Promise<{ statusCode: number }> {
  return h.ctx.app.inject({
    method: "POST",
    url: `/api/exams/${examId}/extend`,
    payload: { extendMinutes, reason: "EXAM-668 research schedule" },
    cookies: { "auth-token": h.adminToken },
  });
}

interface EnrollmentBarrier {
  holding: Deferred<void>;
  waiterSeen: Deferred<void>;
  release: Deferred<void>;
  done: Promise<unknown>;
  close: () => Promise<void>;
}

/**
 * Enrollment row-lock barrier on a dedicated connection: the candidate
 * transaction's first statement fixes its RR snapshot, then it
 * deterministically blocks at the EA seam's Enrollment FOR UPDATE — after
 * snapshot-fix, before any exam access. Arrival is observed precisely via
 * pg_locks waiters on the barrier transaction's own xid.
 */
async function startEnrollmentBarrier(
  h: FixtureHarness,
  fixture: ExamFixture,
  role: "a" | "b",
): Promise<EnrollmentBarrier> {
  const holding = createDeferred<void>("barrier holding");
  const waiterSeen = createDeferred<void>("barrier waiter seen");
  const release = createDeferred<void>("barrier release");
  holding.promise.catch(() => {});
  waiterSeen.promise.catch(() => {});
  release.promise.catch(() => {});

  const connTx = await createPostgresDatabase(
    h.iso.databaseUrl,
    h.iso.schemaName,
  );
  const connProbe = await createPostgresDatabase(
    h.iso.databaseUrl,
    h.iso.schemaName,
  );
  const done = executeInTransaction(connTx.db, async (tx) => {
    const enrollmentRepo = createEnrollmentRepo(tx);
    const enrollment = await enrollmentRepo.findByExamAndCandidateForUpdate(
      fixture.candidates[role].ctx,
      fixture.examId,
      fixture.candidates[role].profileId,
    );
    if (!enrollment) {
      throw new NotFoundError("barrier: enrollment row missing");
    }
    holding.resolve();
    const xidResult = (await tx.execute(
      drizzleSql`SELECT txid_current()::text AS xid`,
    )) as unknown;
    const xidRows =
      (xidResult as { rows?: Array<{ xid: string }> }).rows ??
      (xidResult as Array<{ xid: string }>);
    const xid = xidRows[0]!.xid;
    const predicateDeadline = Date.now() + 10_000;
    for (;;) {
      const waiters = await connProbe.sql`
        SELECT count(*)::int AS n
        FROM pg_locks
        WHERE locktype = 'transactionid'
          AND NOT granted
          AND transactionid = ${xid}::xid
      `;
      if (((waiters[0] as { n: number }).n ?? 0) > 0) {
        waiterSeen.resolve();
        break;
      }
      if (Date.now() > predicateDeadline) {
        throw new Error("no lock waiter appeared on the barrier transaction");
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    await release.promise;
  }).catch((err) => err as Error);

  return {
    holding,
    waiterSeen,
    release,
    done,
    close: async () => {
      await connTx.sql.end();
      await connProbe.sql.end();
    },
  };
}

function recordCounterfactual(testId: string, detail: unknown): void {
  console.info(
    `[exam-668][counterfactual][mode=${MODE}] ${testId}: ${JSON.stringify(detail)}`,
  );
}

describe(`EXAM-668 research probes [lock mode = ${MODE}]`, () => {
  let h: FixtureHarness;
  // createPostgresDatabase with a schema pins max:1 — a parked transaction
  // occupies its handle exclusively, so every competing actor gets its own.
  const actorConns: Array<{ sql: { end(): Promise<void> } }> = [];

  async function createActorConn() {
    const conn = await createPostgresDatabase(h.iso.databaseUrl, h.iso.schemaName);
    actorConns.push(conn);
    return conn;
  }

  beforeAll(async () => {
    h = await setupHarness();
  }, 90_000);

  afterAll(async () => {
    await teardownAll(
      () => Promise.all(actorConns.map((c) => c.sql.end())),
      () => h.sql1.end(),
      () => h.ctx.cleanup(),
      () => h.iso.cleanup(),
    );
  }, 30_000);

  it("T1 reader/reader (same exam, different attempts): mode decides coexist vs queue", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);
    const now = new Date();

    const park = createPark();
    const capturedPid: number[] = [];
    const c1 = runParkedTakeComposition({
      h,
      fixture,
      role: "a",
      now,
      park: {
        afterReconciliation: park.reached,
        afterReconciliationWait: park.wait,
      },
      capturedPid,
    }).catch((err) => err as Error);
    await park.reached.promise;
    expect(capturedPid.length).toBe(1);

    const settled = { settled: false };
    const actorB = await createActorConn();
    const c2 = withSettleFlag(
      submitAndGradeAttempt(
        actorB.db,
        fixture.candidates.b.ctx,
        fixture.attemptIds.b,
        fixture.candidates.b.profileId,
        now,
      ),
      settled,
    ).catch((err) => err as Error);

    if (MODE === "update") {
      // Canonical negative control: the RIG must SEE the reader/reader
      // exclusion the canonical mechanism imposes.
      const waiterPid = await observeBlockerOn(h.iso, capturedPid[0]!);
      expect(waiterPid).toBeGreaterThan(0);
      expect(settled.settled).toBe(false);
    } else {
      // share/none: candidate B completes WHILE candidate A is parked —
      // B's commit happens-before the park release (deterministic order).
      const r2early = (await c2) as unknown as {
        attempt: ExamAttempt;
        alreadyGraded: boolean;
      };
      if (r2early instanceof Error) throw r2early;
      expect(settled.settled).toBe(true);
      expect(r2early.attempt.status).toBe("graded");
      recordCounterfactual("T1", {
        note: "second reader completed while first reader parked",
      });
    }

    park.wait.resolve();
    const r1 = (await c1) as unknown as ExamAttempt;
    if (r1 instanceof Error) throw r1;
    expect(r1.status).toBe("in_progress");

    const r2 = (await c2) as unknown as {
      attempt: ExamAttempt;
      alreadyGraded: boolean;
    };
    if (r2 instanceof Error) throw r2;
    expect(["submitted", "graded"]).toContain(r2.attempt.status);

    const attemptB = await readAttemptRow(h, fixture.attemptIds.b);
    expect(attemptB.submissionReason).toBe("manual");
    const attemptA = await readAttemptRow(h, fixture.attemptIds.a);
    expect(attemptA.status).toBe("in_progress");
  }, 60_000);

  it("T2 submit writer-first: extension committing mid-park governs — no stale deadline freeze", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const extendedCloseAt = new Date(closeAt.getTime() + 30 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);
    // Arrival instant past the OLD closeAt: the stale authority says
    // "expired" — exactly the durable stale-freeze geometry of the pre-#558
    // defect.
    const arrivalNow = new Date(closeAt.getTime() + 1_000);

    const barrier = await startEnrollmentBarrier(h, fixture, "a");
    try {
      await barrier.holding.promise;

      const submitPromise = submitAndGradeAttempt(
        h.db1,
        fixture.candidates.a.ctx,
        fixture.attemptIds.a,
        fixture.candidates.a.profileId,
        arrivalNow,
      ).catch((err) => err as Error);

      await barrier.waiterSeen.promise;
      // Writer-first ordering: the extension commits while the submit holds
      // no exam lock, deterministically before the release.
      const extendRes = await extendExam(h, fixture.examId, 30);
      expect(extendRes.statusCode).toBe(200);

      barrier.release.resolve();
      await barrier.done;

      const result = (await submitPromise) as unknown as {
        attempt: ExamAttempt;
        alreadyGraded: boolean;
      };
      if (result instanceof Error) {
        if (MODE === "none") {
          // Counterfactual failure surface — capture, then classify via row.
          const row = await readAttemptRow(h, fixture.attemptIds.a);
          recordCounterfactual("T2", {
            error: result.message,
            submissionReason: row.submissionReason,
          });
          expect(row.submissionReason).toBe("deadline");
          return;
        }
        throw result;
      }

      if (MODE === "none") {
        // Pre-#558 defect: durable freeze against the replaced authority.
        const row = await readAttemptRow(h, fixture.attemptIds.a);
        recordCounterfactual("T2", {
          submissionReason: row.submissionReason,
          submittedAt: row.submittedAt?.toISOString(),
          staleCloseAt: closeAt.toISOString(),
        });
        expect(row.submissionReason).toBe("deadline");
        expect(row.submittedAt!.getTime()).toBe(closeAt.getTime());
        return;
      }

      // update/share: the whole-tx retry completes the MANUAL submit under
      // the extended authority.
      expect(result.alreadyGraded).toBe(false);
      expect(result.attempt.submissionReason).toBe("manual");
      expect(result.attempt.submittedAt!.getTime()).toBe(arrivalNow.getTime());
      const row = await readAttemptRow(h, fixture.attemptIds.a);
      expect(row.submissionReason).toBe("manual");
      const closeAtRow = await readExamCloseAt(h, fixture.examId);
      expect(closeAtRow!.getTime()).toBe(extendedCloseAt.getTime());
    } finally {
      barrier.release.resolve();
      await barrier.done;
      await barrier.close();
    }
  }, 60_000);

  it("T3 take writer-first: stale pass aborts at the designed Exam lock; retry keeps in_progress", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);
    const staleNow = new Date(closeAt.getTime() + 1_000);

    const park = createPark();
    const passCount: number[] = [];
    const observedStatuses: string[] = [];

    const takePromise = runParkedTakeComposition({
      h,
      fixture,
      role: "a",
      now: staleNow,
      park: {
        beforeReconciliation: park.reached,
        beforeReconciliationWait: park.wait,
      },
      passCount,
      observedStatuses,
    }).catch((err) => err as Error);

    await park.reached.promise;
    const extendRes = await extendExam(h, fixture.examId, 30);
    expect(extendRes.statusCode).toBe(200);
    park.wait.resolve();

    const taken = (await takePromise) as unknown as ExamAttempt;
    if (taken instanceof Error) throw taken;

    if (MODE === "none") {
      // Counterfactual: plain MVCC read evaluates the stale authority in the
      // FIRST (and only) pass — durable deadline freeze, no retry.
      recordCounterfactual("T3", {
        passCount: passCount.length,
        status: taken.status,
        submissionReason: taken.submissionReason,
        submittedAt: taken.submittedAt?.toISOString(),
      });
      expect(passCount.length).toBe(1);
      expect(taken.submissionReason).toBe("deadline");
      expect(taken.submittedAt!.getTime()).toBe(closeAt.getTime());
      expect(["submitted", "graded"]).toContain(taken.status);
      return;
    }

    expect(passCount.length).toBeGreaterThanOrEqual(2);
    expect(observedStatuses).toEqual(["in_progress"]);
    expect(taken.status).toBe("in_progress");
    const row = await readAttemptRow(h, fixture.attemptIds.a);
    expect(row.status).toBe("in_progress");
    expect(row.submittedAt).toBeNull();
    expect(row.submissionReason).toBeNull();
  }, 40_000);

  it("T4 candidate-first: exam writer queues behind the parked candidate's Exam lock", async () => {
    const closeAt = new Date(Date.now() + 30 * MINUTE_MS);
    const extendedCloseAt = new Date(closeAt.getTime() + 30 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);

    const park = createPark();
    const capturedPid: number[] = [];
    const takePromise = runParkedTakeComposition({
      h,
      fixture,
      role: "a",
      now: new Date(),
      park: {
        afterReconciliation: park.reached,
        afterReconciliationWait: park.wait,
      },
      capturedPid,
    }).catch((err) => err as Error);
    await park.reached.promise;

    const extendSettled = { settled: false };
    const extendPromise = withSettleFlag(
      extendExam(h, fixture.examId, 30),
      extendSettled,
    );

    if (MODE === "none") {
      // Counterfactual: with no Exam lock the writer does NOT queue — it
      // commits while the candidate is parked mid-decision.
      const res = await extendPromise;
      expect(res.statusCode).toBe(200);
      expect(extendSettled.settled).toBe(true);
      recordCounterfactual("T4", {
        note: "extend committed while candidate parked (no designed lock)",
      });
      park.wait.resolve();
      const r1 = (await takePromise) as unknown as ExamAttempt;
      if (r1 instanceof Error) throw r1;
      expect(r1.status).toBe("in_progress");
      return;
    }

    const waiterPid = await observeBlockerOn(h.iso, capturedPid[0]!);
    expect(waiterPid).toBeGreaterThan(0);
    expect(extendSettled.settled).toBe(false);

    park.wait.resolve();
    const r1 = (await takePromise) as unknown as ExamAttempt;
    if (r1 instanceof Error) throw r1;
    expect(r1.status).toBe("in_progress");

    const res = await extendPromise;
    expect(res.statusCode).toBe(200);
    const closeAtRow = await readExamCloseAt(h, fixture.examId);
    expect(closeAtRow!.getTime()).toBe(extendedCloseAt.getTime());
  }, 40_000);

  it("T5 same-attempt save vs submit: submit serializes on the EA lock family and freezes the latest accepted draft", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);
    const now = new Date();

    const park = createPark();
    const capturedPid: number[] = [];
    const savePromise = runParkedSaveComposition({
      h,
      fixture,
      now,
      park: {
        afterPreparation: park.reached,
        afterPreparationWait: park.wait,
      },
      capturedPid,
    }).catch((err) => err as Error);
    await park.reached.promise;
    expect(capturedPid.length).toBe(1);

    // While the save is parked (holding Enrollment + Attempt + Exam locks),
    // launch the candidate submit — it must queue on the EA lock family in
    // every mode.
    const actorS = await createActorConn();
    const submitPromise = submitAndGradeAttempt(
      actorS.db,
      fixture.candidates.a.ctx,
      fixture.attemptIds.a,
      fixture.candidates.a.profileId,
      now,
    ).catch((err) => err as Error);
    const waiterPid = await observeBlockerOn(h.iso, capturedPid[0]!);
    expect(waiterPid).toBeGreaterThan(0);

    // Save commits (accepted write + receipt), THEN the submit proceeds via
    // the whole-tx retry and freezes the accepted answer.
    park.wait.resolve();
    const saved = (await savePromise) as unknown as Awaited<
      ReturnType<typeof saveAnswer>
    >;
    if (saved instanceof Error) throw saved;
    expect(saved.accepted).toBe(true);

    const r = (await submitPromise) as unknown as {
      attempt: ExamAttempt;
      alreadyGraded: boolean;
    };
    if (r instanceof Error) throw r;

    expect(r.alreadyGraded).toBe(false);
    const row = await readAttemptRow(h, fixture.attemptIds.a);
    expect(["submitted", "graded"]).toContain(row.status);
    const frozen = row.submittedAnswers?.answers ?? [];
    expect(frozen.some((a) => a.value === "a")).toBe(true);
  }, 60_000);

  it("T6 submit vs scanner (same exam, different attempts): scanner's Exam FOR UPDATE queues behind the parked candidate, canonical recheck no-ops", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);
    const now = new Date();

    const park = createPark();
    const capturedPid: number[] = [];
    const c1 = runParkedTakeComposition({
      h,
      fixture,
      role: "a",
      now,
      park: {
        afterReconciliation: park.reached,
        afterReconciliationWait: park.wait,
      },
      capturedPid,
    }).catch((err) => err as Error);
    await park.reached.promise;

    const actorScan = await createActorConn();
    const scanPromise = autoSubmitAndGrade(
      actorScan.db,
      createSystemRequestContext(
        fixture.orgId,
        SYSTEM_ACTOR_IDS.DeadlineScanner,
      ),
      fixture.attemptIds.b,
      now, // B is not expired: the under-lock canonical recheck must no-op.
    ).catch((err) => err as Error);

    if (MODE !== "none") {
      // update and share alike: the scanner's Exam FOR UPDATE conflicts with
      // the candidate's held Exam lock.
      const waiterPid = await observeBlockerOn(h.iso, capturedPid[0]!);
      expect(waiterPid).toBeGreaterThan(0);
    }

    park.wait.resolve();
    const r1 = (await c1) as unknown as ExamAttempt;
    if (r1 instanceof Error) throw r1;
    expect(r1.status).toBe("in_progress");

    const scan = (await scanPromise) as unknown as boolean;
    if (scan instanceof Error) throw scan;
    expect(scan).toBe(false);
    const rowB = await readAttemptRow(h, fixture.attemptIds.b);
    expect(rowB.status).toBe("in_progress");
    const rowA = await readAttemptRow(h, fixture.attemptIds.a);
    expect(rowA.status).toBe("in_progress");
  }, 40_000);

  it("T7 different-exam negative control: parked candidate on exam 1 never blocks candidate on exam 2", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixtureA = await setupExamFixture(h, closeAt);
    const fixtureB = await setupExamFixture(h, closeAt);
    const now = new Date();

    const parkA = createPark();
    const c1 = runParkedTakeComposition({
      h,
      fixture: fixtureA,
      role: "a",
      now,
      park: {
        afterReconciliation: parkA.reached,
        afterReconciliationWait: parkA.wait,
      },
    }).catch((err) => err as Error);
    await parkA.reached.promise;

    const settled = { settled: false };
    const actorB2 = await createActorConn();
    const c2 = withSettleFlag(
      submitAndGradeAttempt(
        actorB2.db,
        fixtureB.candidates.a.ctx,
        fixtureB.attemptIds.a,
        fixtureB.candidates.a.profileId,
        now,
      ),
      settled,
    ).catch((err) => err as Error);

    const r2 = (await c2) as unknown as { attempt: ExamAttempt };
    if (r2 instanceof Error) throw r2;
    expect(settled.settled).toBe(true);

    parkA.wait.resolve();
    const r1 = (await c1) as unknown as ExamAttempt;
    if (r1 instanceof Error) throw r1;
    expect(r1.status).toBe("in_progress");
  }, 60_000);

  it("T8 SQL witness: FOR SHARE coexists with FOR SHARE; concurrent shared-holder upgrade race deadlocks (40P01)", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const fixture = await setupExamFixture(h, closeAt);

    const connA = await createPostgresDatabase(
      h.iso.databaseUrl,
      h.iso.schemaName,
    );
    const connB = await createPostgresDatabase(
      h.iso.databaseUrl,
      h.iso.schemaName,
    );
    const s1 = await connA.sql.reserve();
    const s2 = await connB.sql.reserve();
    try {
      await s1.unsafe("BEGIN");
      await s1.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await s2.unsafe("BEGIN");
      await s2.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");

      const share = "SELECT id FROM exams WHERE id = $1 FOR SHARE";
      const upd = "SELECT id FROM exams WHERE id = $1 FOR UPDATE";
      await s1.unsafe(share, [fixture.examId]);
      await s2.unsafe(share, [fixture.examId]);

      // Both hold FOR SHARE; both request FOR UPDATE — a classic upgrade
      // race. Each waits for the other's share release; PostgreSQL must
      // detect the cycle and abort exactly one side with 40P01.
      const p1 = s1
        .unsafe(upd, [fixture.examId])
        .then(() => "ok" as const)
        .catch((e) => (e as { code?: string }).code ?? "unknown");
      const p2 = s2
        .unsafe(upd, [fixture.examId])
        .then(() => "ok" as const)
        .catch((e) => (e as { code?: string }).code ?? "unknown");
      const codes = await Promise.all([p1, p2]);
      expect(codes).toContain("40P01");
      expect(codes.filter((c) => c === "40P01").length).toBe(1);

      await s1.unsafe("ROLLBACK");
      await s2.unsafe("ROLLBACK");
    } finally {
      s1.release();
      s2.release();
      await connA.sql.end();
      await connB.sql.end();
    }
  }, 40_000);
});
