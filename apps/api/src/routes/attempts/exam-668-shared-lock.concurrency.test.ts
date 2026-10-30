/**
 * EXAM-668 — Candidate Deadline Reader shared-lock concurrency regression.
 * Companion to candidate-deadline-authority.concurrency.test.ts (#558) and
 * candidate-save-deadline-race.concurrency.test.ts (#543), which keep the
 * writer-first 40001 + whole-tx-retry and save/save relations green for the
 * shared-mode reader (those suites drive the REAL routes, so they exercise
 * the production FOR SHARE seam directly and are NOT duplicated here).
 *
 * What this suite alone can pin is the lock-mode relation itself:
 *
 *   T1   reader/reader COEXIST — two transactions hold the exam FOR SHARE
 *        simultaneously, with an empty pg_blocking_pids relation (the #586
 *        reader convoy is structurally gone).
 *   T1c  control — the same schedule under FOR UPDATE shows the convoy
 *        (a provable lock waiter). Guards T1 against a false green and is
 *        the RED oracle for a revert of the reader to the writer lock.
 *   T2   reader-first/writer-second — a committed exam writer queues behind
 *        a parked shared reader (FOR SHARE conflicts with FOR UPDATE).
 *   T3   writer-first/stale snapshot — a closeAt change committing while a
 *        pass is parked before its shared read raises 40001 at THAT read and
 *        the whole-transaction retry converges on the new authority.
 *   T8   deliberate upgrade — two shared holders requesting the writer lock
 *        deadlock (exactly one 40P01 victim). This is the violation oracle:
 *        it proves PostgreSQL surfaces the exact failure the #668 no-upgrade
 *        invariant forbids, so the production-path test below cannot pass
 *        vacuously.
 *   NOPG no-upgrade — the REAL submitAndGradeAttempt orchestrator completes
 *        while another transaction holds the exam FOR SHARE. Any future
 *        exam-write introduction after the reader's shared lock would
 *        deadlock against the parked holder (T8's mechanism) and fail here.
 *
 * Schedules are forced by deferred park points and observed via pg_locks /
 * pg_stat_activity liveness predicates with hard timeouts — no sleep gates
 * any outcome; a missed waiter fails the test loudly. T8 deliberately
 * increments pg_stat_database.deadlocks by 1 (isolated per-test schema).
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
import { createExamRepo } from "@exam/db/repository/examRepo";
import { createDeferred, type Deferred } from "../../testing/barrier.js";
import {
  executeInTransaction,
  hasPostgresErrorCode,
  type Database,
} from "@exam/db/types";
import { submitAndGradeAttempt } from "../../orchestrators/submitAndGradeAttempt.js";
import { hashPassword } from "@exam/auth/password";
import { signJWT } from "@exam/auth/session";
import { getRuntimeConfig } from "../../config/runtimeConfig.js";
import type { Permission, RequestContext, Role } from "@exam/domain";
import type { ExamAttempt } from "@exam/domain";
import { and, eq, sql as drizzleSql } from "drizzle-orm";

process.env.DEADLINE_SCAN_INTERVAL_MS = "3600000";

const MINUTE_MS = 60_000;

/** A dedicated single-connection pool handle from createPostgresDatabase. */
type PgConn = Awaited<ReturnType<typeof createPostgresDatabase>>;

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

/**
 * Parks a dedicated-connection transaction holding the exam row in the given
 * lock mode until released. Resolves `reached` after the lock is held and
 * `pid` with the backend pid (for pg_blocking_pids assertions).
 */
function parkExamLock(args: {
  databaseUrl: string;
  schemaName: string;
  ctx: RequestContext;
  examId: string;
  mode: "share" | "update";
}): {
  reached: Deferred<void>;
  pid: Promise<number>;
  done: Promise<unknown>;
  release: () => void;
  close: () => Promise<void>;
} {
  const reached = createDeferred<void>("park reached");
  const wait = createDeferred<void>("park release");
  let releasePid: (pid: number) => void;
  const pid = new Promise<number>((resolve) => {
    releasePid = resolve;
  });
  pid.catch(() => {});
  wait.promise.catch(() => {});
  let conn: Awaited<ReturnType<typeof createPostgresDatabase>> | undefined;
  const done = (async () => {
    conn = await createPostgresDatabase(args.databaseUrl, args.schemaName);
    return executeInTransaction(conn.db, async (tx) => {
      const repo = createExamRepo(tx);
      const exam =
        args.mode === "share"
          ? await repo.findByIdForShare(args.ctx, args.examId)
          : await repo.findByIdForUpdate(args.ctx, args.examId);
      if (!exam) throw new Error(`park: exam ${args.examId} missing`);
      const pidRow = (await tx.execute(
        drizzleSql`SELECT pg_backend_pid()::int AS pid`,
      )) as unknown;
      const rows =
        (pidRow as { rows?: Array<{ pid: number }> }).rows ??
        (pidRow as Array<{ pid: number }>);
      releasePid(rows[0]!.pid);
      reached.resolve();
      await wait.promise;
      return exam.id;
    });
  })().catch((err) => err as Error);

  return {
    reached,
    pid,
    done,
    release: () => wait.resolve(),
    close: async () => {
      await conn?.sql.end();
    },
  };
}

/**
 * Liveness predicate with a hard timeout: resolves once at least
 * `minWaiters` client backends on this database are actively waiting on a
 * row lock. A miss fails loudly — it never degrades into a timing assumption.
 */
async function waitForRowLockWaiters(args: {
  probe: { sql: PgConn["sql"] };
  minWaiters: number;
  label: string;
  timeoutMs?: number;
}): Promise<void> {
  const deadline = Date.now() + (args.timeoutMs ?? 10_000);
  for (;;) {
    const rows = (await args.probe.sql`
      SELECT count(*)::int AS n
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND backend_type = 'client backend'
        AND state = 'active'
        AND wait_event_type = 'Lock'
    `) as Array<{ n: number }>;
    if ((rows[0]?.n ?? 0) >= args.minWaiters) return;
    if (Date.now() > deadline) {
      throw new Error(
        `liveness miss (${args.label}): no row-lock waiter appeared`,
      );
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function blockingPids(
  probe: { sql: PgConn["sql"] },
  pid: number,
): Promise<number[]> {
  const rows = (await probe.sql`
    SELECT pg_blocking_pids(${pid}::int) AS blockers
  `) as Array<{ blockers: number[] }>;
  return rows[0]?.blockers ?? [];
}

/**
 * The REAL exam-window writer: POST /api/exams/:id/extend (the same writer
 * the #558 suite stages), committing closeAt = closeAt + extendMinutes.
 */
async function extendExam(
  ctx: Awaited<ReturnType<typeof buildTestApp>>,
  examId: string,
  adminToken: string,
  extendMinutes: number,
): Promise<{ statusCode: number }> {
  return ctx.app.inject({
    method: "POST",
    url: `/api/exams/${examId}/extend`,
    payload: { extendMinutes, reason: "EXAM-668 concurrency regression" },
    cookies: { "auth-token": adminToken },
  });
}

describe("EXAM-668 — shared candidate deadline reader lock relations", () => {
  let iso: Awaited<ReturnType<typeof setupIsolatedTestDb>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let adminCtx: RequestContext;
  let candidateCtx: RequestContext;
  let adminToken: string;
  let candidateToken: string;
  let courseId: string;
  let questionId: string;
  let profileId: string;

  beforeAll(async () => {
    iso = await setupIsolatedTestDb({
      namespace: "api",
      databaseUrl: resolveTestDbUrl(),
    });
    ctx = await buildTestApp(
      async (fastify) => {
        await fastify.register(examRoutes, { prefix: "" });
        await fastify.register(attemptRoutes, { prefix: "" });
      },
      { schemaName: iso.schemaName },
    );

    const now = new Date();
    const slug = `exam-668-${randomUUID().slice(0, 8)}`;
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

    const passwordHash = await hashPassword("password123");
    const adminId = randomUUID();
    const candidateUserId = randomUUID();
    for (const user of [
      { id: adminId, username: `admin-${slug}`, role: "Admin" },
      {
        id: candidateUserId,
        username: `cand-${slug}`,
        role: "Candidate",
      },
    ] as const) {
      await ctx.db.insert(schema.users).values({
        id: user.id,
        organizationId: org.id,
        username: user.username,
        passwordHash,
        name: user.role,
        role: user.role,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert(schema.userRoleAssignments).values({
        id: randomUUID(),
        organizationId: org.id,
        userId: user.id,
        role: user.role,
        isPrimary: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const { jwtSecret } = getRuntimeConfig().authSecret;
    adminToken = signJWT(
      {
        actorId: adminId,
        role: "Admin",
        organizationId: org.id,
        authEpoch: 0,
      },
      jwtSecret,
    );
    candidateToken = signJWT(
      {
        actorId: candidateUserId,
        role: "Candidate",
        organizationId: org.id,
        authEpoch: 0,
      },
      jwtSecret,
    );
    const mkCtx = (actorId: string, role: Role): RequestContext => ({
      actorId,
      organizationId: org.id,
      role,
      permissions: [] as Permission[],
      sessionId: `exam-668-${role}`,
      targetOrganizationId: org.id,
    });
    adminCtx = mkCtx(adminId, "Admin");
    candidateCtx = mkCtx(candidateUserId, "Candidate");

    const course = (
      await ctx.db
        .insert(schema.courses)
        .values({
          id: randomUUID(),
          organizationId: org.id,
          name: `Course ${slug}`,
          code: `C-${slug}`,
          description: "",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    courseId = course.id;
    const question = (
      await ctx.db
        .insert(schema.questions)
        .values({
          id: randomUUID(),
          organizationId: org.id,
          type: "single_choice" as const,
          content: "EXAM-668",
          options: [
            { id: "a", content: "1" },
            { id: "b", content: "2" },
          ],
          standardAnswer: "a",
          attachments: [],
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
    questionId = question.id;

    const profile = (
      await ctx.db
        .insert(schema.candidateProfiles)
        .values({
          id: randomUUID(),
          organizationId: org.id,
          userId: candidateUserId,
          fields: {},
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0]!;
    profileId = profile.id;
  }, 60_000);

  afterAll(async () => {
    await teardownAll(
      () => ctx.cleanup(),
      () => iso.cleanup(),
    );
  }, 30_000);

  /** Fresh exam row per test — lock schedules never couple across tests. */
  async function createExam(closeAt: Date): Promise<string> {
    const now = new Date();
    const slug = `exam-668-${randomUUID().slice(0, 8)}`;
    const exam = (
      await ctx.db
        .insert(schema.exams)
        .values({
          id: randomUUID(),
          organizationId: adminCtx.organizationId,
          title: `EXAM-668 ${slug}`,
          description: "",
          courseId,
          status: "open",
          timingMode: "deadline" as const,
          durationMinutes: null,
          openAt: new Date(now.getTime() - 60 * MINUTE_MS),
          closeAt,
          passingScore: 60,
          totalScore: 100,
          questionSelectionMode: "manual",
          questionIds: [questionId],
          questionSnapshot: [
            {
              originalQuestionId: questionId,
              type: "single_choice" as const,
              content: "EXAM-668",
              contentDocument: null,
              answerMode: null,
              attachments: [],
              options: [
                { id: "a", content: "1" },
                { id: "b", content: "2" },
              ],
              standardAnswer: "a",
              score: 100,
              gradingRule: {
                multiSelectScoring: "all_correct_full",
                fillBlankMatchMode: "exact",
              },
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
    return exam.id;
  }

  /** Enrolls the suite candidate into the exam and starts an attempt. */
  async function enrollAndStart(examId: string): Promise<string> {
    const enrollRes = await ctx.app.inject({
      method: "POST",
      url: `/api/exams/${examId}/enrollments`,
      payload: { candidateIds: [profileId] },
      cookies: { "auth-token": adminToken },
    });
    if (enrollRes.statusCode !== 200) {
      throw new Error(
        `enroll failed: ${enrollRes.statusCode} ${enrollRes.body}`,
      );
    }
    const startRes = await ctx.app.inject({
      method: "POST",
      url: `/api/attempts/${examId}/start`,
      cookies: { "auth-token": candidateToken },
    });
    if (startRes.statusCode !== 201) {
      throw new Error(`start failed: ${startRes.statusCode} ${startRes.body}`);
    }
    return startRes.json().id as string;
  }

  it("T1 reader/reader: two transactions hold the exam FOR SHARE simultaneously with no blocking relation", async () => {
    const examId = await createExam(new Date(Date.now() + 60 * MINUTE_MS));
    const s1 = parkExamLock({
      databaseUrl: iso.databaseUrl,
      schemaName: iso.schemaName,
      ctx: candidateCtx,
      examId,
      mode: "share",
    });
    let s2: ReturnType<typeof parkExamLock> | undefined;
    const probe = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);
    try {
      await s1.reached.promise;
      const pid1 = await s1.pid;

      // The second shared reader must acquire while the first still parks.
      s2 = parkExamLock({
        databaseUrl: iso.databaseUrl,
        schemaName: iso.schemaName,
        ctx: candidateCtx,
        examId,
        mode: "share",
      });
      await s2.reached.promise;
      const pid2 = await s2.pid;

      // No blocking relation in either direction (the #586 convoy shape).
      expect(await blockingPids(probe, pid1)).toEqual([]);
      expect(await blockingPids(probe, pid2)).toEqual([]);

      s2.release();
      expect(await s2.done).toBe(examId);
      s1.release();
      expect(await s1.done).toBe(examId);
    } finally {
      s1.release();
      s2?.release();
      await teardownAll(
        s1.close,
        () => s2?.close() ?? Promise.resolve(),
        () => probe.sql.end(),
      );
    }
  }, 30_000);

  it("T1-control FOR UPDATE: the same schedule shows the reader convoy (T1 cannot pass vacuously)", async () => {
    const examId = await createExam(new Date(Date.now() + 60 * MINUTE_MS));
    const u1 = parkExamLock({
      databaseUrl: iso.databaseUrl,
      schemaName: iso.schemaName,
      ctx: candidateCtx,
      examId,
      mode: "update",
    });
    const probe = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);
    let u2: ReturnType<typeof parkExamLock> | undefined;
    try {
      await u1.reached.promise;

      // The second exclusive reader must BLOCK while the first parks.
      u2 = parkExamLock({
        databaseUrl: iso.databaseUrl,
        schemaName: iso.schemaName,
        ctx: candidateCtx,
        examId,
        mode: "update",
      });
      await waitForRowLockWaiters({
        probe,
        minWaiters: 1,
        label: "T1-control FOR UPDATE waiter",
      });

      // Releasing the holder unfreezes the convoyed reader.
      u1.release();
      expect(await u1.done).toBe(examId);
      u2.release();
      expect(await u2.done).toBe(examId);
    } finally {
      u1.release();
      u2?.release();
      await teardownAll(
        u1.close,
        () => u2?.close() ?? Promise.resolve(),
        () => probe.sql.end(),
      );
    }
  }, 30_000);

  it("T2 reader-first/writer-second: an exam-window writer queues behind a parked shared reader", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const extendedCloseAt = new Date(closeAt.getTime() + 30 * MINUTE_MS);
    const examId = await createExam(closeAt);
    const s1 = parkExamLock({
      databaseUrl: iso.databaseUrl,
      schemaName: iso.schemaName,
      ctx: candidateCtx,
      examId,
      mode: "share",
    });
    const writer = await createPostgresDatabase(
      iso.databaseUrl,
      iso.schemaName,
    );
    const probe = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);
    try {
      await s1.reached.promise;

      const writerDone = executeInTransaction(writer.db, async (tx) => {
        const repo = createExamRepo(tx);
        const exam = await repo.findByIdForUpdate(adminCtx, examId);
        if (!exam) throw new Error("writer: exam missing");
        await repo.update(adminCtx, examId, { closeAt: extendedCloseAt });
        return exam.closeAt;
      }).catch((err) => err as Error);

      // The writer is provably queued on the shared reader's lock.
      await waitForRowLockWaiters({
        probe,
        minWaiters: 1,
        label: "T2 writer behind shared reader",
      });
      const row = (
        await ctx.db
          .select({ closeAt: schema.exams.closeAt })
          .from(schema.exams)
          .where(eq(schema.exams.id, examId))
          .limit(1)
      )[0];
      expect(row?.closeAt).toEqual(closeAt);

      s1.release();
      expect(await s1.done).toBe(examId);
      expect(await writerDone).not.toBeInstanceOf(Error);
      const after = (
        await ctx.db
          .select({ closeAt: schema.exams.closeAt })
          .from(schema.exams)
          .where(eq(schema.exams.id, examId))
          .limit(1)
      )[0];
      expect(after?.closeAt).toEqual(extendedCloseAt);
    } finally {
      s1.release();
      await teardownAll(
        s1.close,
        () => writer.sql.end(),
        () => probe.sql.end(),
      );
    }
  }, 30_000);

  it("T3 writer-first/stale snapshot: the shared read raises 40001 and the whole-transaction retry lands on the new authority", async () => {
    const closeAt = new Date(Date.now() + 60 * MINUTE_MS);
    const extendedCloseAt = new Date(closeAt.getTime() + 30 * MINUTE_MS);
    const examId = await createExam(closeAt);

    const reader = await createPostgresDatabase(
      iso.databaseUrl,
      iso.schemaName,
    );
    const passCount: number[] = [];
    const pass1Errors: unknown[] = [];
    const reached = createDeferred<void>("pass 1 parked pre-lock");
    const release = createDeferred<void>("pass 1 release");
    release.promise.catch(() => {});

    const resultPromise = executeInTransaction(reader.db, async (tx) => {
      passCount.push(1);
      const repo = createExamRepo(tx);
      // Plain read fixes the RR snapshot for this pass.
      await repo.findById(adminCtx, examId);
      if (passCount.length === 1) {
        reached.resolve();
        await release.promise;
      }
      try {
        const locked = await repo.findByIdForShare(adminCtx, examId);
        return locked;
      } catch (err) {
        pass1Errors.push(err);
        throw err;
      }
    });

    await reached.promise;
    try {
      // The extension commits while pass 1 is parked BEFORE its shared read —
      // writer-first ordering, deterministically before the lock attempt.
      const extendRes = await extendExam(ctx, examId, adminToken, 30);
      expect(extendRes.statusCode).toBe(200);
      release.resolve();

      const locked = await resultPromise;
      expect(locked).not.toBeNull();
      expect(locked?.closeAt).toEqual(extendedCloseAt);
      // Pass 1 aborted at the DESIGNED shared read (40001), and the retry
      // (pass 2) observed the committed authority — the #558 contract, now on
      // the shared-mode reader.
      expect(passCount).toHaveLength(2);
      expect(pass1Errors).toHaveLength(1);
      expect(hasPostgresErrorCode(pass1Errors[0], "40001")).toBe(true);
    } finally {
      // Always release the parked pass and its connection, even on a failed
      // assertion — a stuck pass 1 would only end at the barrier timeout.
      release.resolve();
      await reader.sql.end();
    }
  }, 30_000);
  it("T8 deliberate upgrade: two shared holders upgrading in-transaction deadlock (exactly one 40P01 victim)", async () => {
    const examId = await createExam(new Date(Date.now() + 60 * MINUTE_MS));
    const probe = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);

    /**
     * One violation session: a raw (non-retrying) RR transaction holds the
     * exam FOR SHARE, parks, then — on `goUpgrade` — requests FOR UPDATE in
     * the SAME transaction. Two such sessions against one exam row form the
     * classic shared-holder upgrade cycle (each waits for the other's share
     * with its own update request queued behind the other's), which
     * PostgreSQL must resolve by aborting exactly one victim with 40P01.
     * Raw transactions because the injected violation must SURFACE the
     * deadlock signature — executeInTransaction would retry over it.
     */
    const upgradeSession = () => {
      const reached = createDeferred<void>("upgrade holder parked");
      const goUpgrade = createDeferred<void>("upgrade go");
      let releasePid: (pid: number) => void = () => {};
      const pid = new Promise<number>((resolve) => {
        releasePid = resolve;
      });
      pid.catch(() => {});
      goUpgrade.promise.catch(() => {});
      let conn: Awaited<ReturnType<typeof createPostgresDatabase>> | undefined;
      const done = (async () => {
        conn = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);
        return conn!.db.transaction(
          async (tx) => {
            await tx.execute(
              drizzleSql`SELECT id FROM exams WHERE id = ${examId} FOR SHARE`,
            );
            const pidRow = (await tx.execute(
              drizzleSql`SELECT pg_backend_pid()::int AS pid`,
            )) as unknown;
            const rows =
              (pidRow as { rows?: Array<{ pid: number }> }).rows ??
              (pidRow as Array<{ pid: number }>);
            releasePid(rows[0]!.pid);
            reached.resolve();
            await goUpgrade.promise;
            await tx.execute(
              drizzleSql`SELECT id FROM exams WHERE id = ${examId} FOR UPDATE`,
            );
            return "upgraded";
          },
          { isolationLevel: "repeatable read" },
        );
      })().then(
        (r) => r as string,
        (err) => err as Error,
      );

      return {
        reached,
        goUpgrade,
        pid,
        done,
        close: () => conn?.sql.end() ?? Promise.resolve(),
      };
    };

    const s1 = upgradeSession();
    const s2 = upgradeSession();
    try {
      await s1.reached.promise;
      await s2.reached.promise;

      // Deterministic cycle formation: holder 1 upgrades first and must be a
      // visible lock waiter BEFORE holder 2 requests its upgrade.
      s1.goUpgrade.resolve();
      await waitForRowLockWaiters({
        probe,
        minWaiters: 1,
        label: "T8 first upgrade queued on the peer share",
      });
      s2.goUpgrade.resolve();

      const results = await Promise.all([s1.done, s2.done]);
      const victims = results.filter((r) => r instanceof Error);
      expect(victims).toHaveLength(1);
      expect(hasPostgresErrorCode(victims[0], "40P01")).toBe(true);
      // The survivor acquired the writer lock and committed.
      expect(results.find((r) => !(r instanceof Error))).toBe("upgraded");
    } finally {
      s1.goUpgrade.resolve();
      s2.goUpgrade.resolve();
      await teardownAll(s1.close, s2.close, () => probe.sql.end());
    }
  }, 30_000);

  it("NOPG no-upgrade: the REAL submit orchestrator completes while another transaction holds the exam FOR SHARE", async () => {
    const examId = await createExam(new Date(Date.now() + 60 * MINUTE_MS));
    const attemptId = await enrollAndStart(examId);

    const holder = parkExamLock({
      databaseUrl: iso.databaseUrl,
      schemaName: iso.schemaName,
      ctx: candidateCtx,
      examId,
      mode: "share",
    });
    const conn1 = await createPostgresDatabase(iso.databaseUrl, iso.schemaName);
    try {
      await holder.reached.promise;

      // The production candidate submit path takes its own shared read and
      // never upgrades to an exam write — completion under the parked holder
      // is the oracle (any exam-write introduction would deadlock here, by
      // T8's mechanism).
      const { attempt } = await submitAndGradeAttempt(
        conn1.db,
        candidateCtx,
        attemptId,
        profileId,
        new Date(),
      );
      expect(["submitted", "graded"]).toContain(attempt.status);

      const row = (
        await ctx.db
          .select({ status: schema.examAttempts.status })
          .from(schema.examAttempts)
          .where(
            and(
              eq(schema.examAttempts.id, attemptId),
              eq(
                schema.examAttempts.organizationId,
                candidateCtx.organizationId,
              ),
            ),
          )
          .limit(1)
      )[0];
      expect(["submitted", "graded"]).toContain(row?.status);

      holder.release();
      expect(await holder.done).toBe(examId);
    } finally {
      holder.release();
      await teardownAll(holder.close, () => conn1.sql.end());
    }
  }, 30_000);
});
