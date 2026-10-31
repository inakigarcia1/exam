import type { Database } from "../types.js";
import {
  candidateProfiles,
  examEnrollments,
  exams,
  users,
} from "../schema/pg.js";
import {
  createAsyncTenantCrudRepo,
  resolveOptionalOrganizationId,
} from "./baseRepo.js";
import type { TenantContext } from "../types.js";
import type { RequestContext } from "@exam/domain";
import { and, count, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";

/** Filter options for listing candidates with DB-level filtering. */
export interface CandidateListFilters {
  /**
   * Case-insensitive substring search over the candidate user's `name` and
   * `username` (EXISTS, SQL-side, applied BEFORE limit/offset and the total
   * count). The stored term is trimmed; an empty term after trim filters
   * nothing (legacy listing semantics).
   */
  search?: string;
  /**
   * Restrict the listing to candidates with an ENROLLMENT whose exam's course
   * is one of `courseIds` (LIST scope filter). Applied in SQL BEFORE
   * limit/offset and the total count. An EMPTY array yields
   * `{ items: [], total: 0 }` by contract (never unfiltered).
   */
  courseIds?: string[];
}

type CandidateProfileRow = typeof candidateProfiles.$inferSelect;

/** A profile whose candidate account still exists. */
export type ActiveCandidateProfile = CandidateProfileRow & { userId: string };

/** Display identity of a profile, live or kept after the candidate was deleted. */
export function candidateIdentity(
  profile: Pick<CandidateProfileRow, "formerName" | "formerUsername">,
  user: { name: string; username: string } | null | undefined,
): { name: string; username: string } {
  return {
    name: user?.name ?? profile.formerName ?? "",
    username: user?.username ?? profile.formerUsername ?? "",
  };
}

/** Creates a tenant-scoped CRUD repository for `candidateProfiles` with user lookup. */
export function createCandidateRepo(db: Database) {
  const repo = createAsyncTenantCrudRepo(db, candidateProfiles);
  const active = isNotNull(candidateProfiles.userId);

  /**
   * Batch-loads candidate profiles by id, scoped to the tenant. Empty input
   * returns []. Used by the result_published recipient composition to
   * resolve candidateProfile -> userId without an N+1.
   */
  async function findByIds(
    ctx: TenantContext | RequestContext,
    candidateIds: string[],
  ) {
    if (candidateIds.length === 0) return [];
    const orgId = resolveOptionalOrganizationId(ctx);
    const rows = await db
      .select()
      .from(candidateProfiles)
      .where(
        and(
          eq(candidateProfiles.organizationId, orgId),
          inArray(candidateProfiles.id, candidateIds),
        ),
      );
    return rows as (typeof candidateProfiles.$inferSelect)[];
  }

  return {
    ...repo,
    findByIds,
    /** Profiles of candidates that still exist (deleted ones are excluded). */
    async list(
      ctx: TenantContext | RequestContext,
    ): Promise<ActiveCandidateProfile[]> {
      const rows = await db
        .select()
        .from(candidateProfiles)
        .where(
          and(
            eq(
              candidateProfiles.organizationId,
              resolveOptionalOrganizationId(ctx),
            ),
            active,
          ),
        );
      return rows as ActiveCandidateProfile[];
    },
    async count(ctx: TenantContext | RequestContext): Promise<number> {
      const rows = await db
        .select({ value: count() })
        .from(candidateProfiles)
        .where(
          and(
            eq(
              candidateProfiles.organizationId,
              resolveOptionalOrganizationId(ctx),
            ),
            active,
          ),
        );
      return Number(rows[0]?.value ?? 0);
    },
    /** Like findById, but null for a deleted candidate. */
    async findActiveById(
      ctx: TenantContext | RequestContext,
      id: string,
    ): Promise<ActiveCandidateProfile | null> {
      const row = await repo.findById(ctx, id);
      return row && row.userId !== null
        ? (row as ActiveCandidateProfile)
        : null;
    },
    /**
     * Finds a candidate profile by the associated user ID, scoped to the tenant.
     */
    async findByUserId(ctx: TenantContext | RequestContext, userId: string) {
      const orgId = resolveOptionalOrganizationId(ctx);
      const rows = await db
        .select()
        .from(candidateProfiles)
        .where(
          and(
            eq(candidateProfiles.organizationId, orgId),
            eq(candidateProfiles.userId, userId),
          ),
        );
      return (rows[0] as ActiveCandidateProfile | undefined) ?? null;
    },
    /** Counts attempts the candidate is still answering. */
    async countLiveAttempts(
      ctx: TenantContext | RequestContext,
      id: string,
    ): Promise<number> {
      const orgId = resolveOptionalOrganizationId(ctx);
      const rows = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM exam_attempts
        WHERE organization_id = ${orgId} AND candidate_id = ${id}
          AND status IN ('in_progress', 'disrupted')`);
      return Number(rows[0]?.n ?? 0);
    },
    /**
     * Deletes the candidate's account and every enrollment without attempts.
     * Attempts already taken (and their enrollments) stay: the profile is
     * kept with the user detached and the identity copied into former*.
     * Must run inside the caller's transaction, with no live attempts.
     */
    async deleteCandidate(
      ctx: TenantContext | RequestContext,
      profile: ActiveCandidateProfile,
      identity: { name: string; username: string },
      now: Date,
    ): Promise<void> {
      const orgId = resolveOptionalOrganizationId(ctx);
      const { id, userId } = profile;
      await db.execute(sql`
        DELETE FROM exam_admissions
        WHERE organization_id = ${orgId} AND candidate_id = ${id}
          AND consumed_attempt_id IS NULL`);
      await db.execute(sql`
        DELETE FROM exam_enrollments e
        WHERE e.organization_id = ${orgId} AND e.candidate_id = ${id}
          AND NOT EXISTS (
            SELECT 1 FROM exam_attempts a WHERE a.enrollment_id = e.id)`);
      // The candidate's own idempotency receipts only replay commands of a
      // finished attempt; nothing reads them once the account is gone.
      await db.execute(sql`
        DELETE FROM attempt_command_receipts
        WHERE organization_id = ${orgId} AND actor_id = ${userId}`);
      await db.execute(sql`
        UPDATE attempt_interruption_events SET actor_id = NULL
        WHERE organization_id = ${orgId} AND actor_id = ${userId}`);
      await db.execute(sql`
        UPDATE attempt_time_adjustments SET actor_id = NULL
        WHERE organization_id = ${orgId} AND actor_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM email_outbox
        WHERE organization_id = ${orgId} AND (recipient_user_id = ${userId}
          OR notification_id IN (
            SELECT id FROM notifications WHERE recipient_user_id = ${userId}))`);
      await db.execute(sql`
        DELETE FROM notifications
        WHERE organization_id = ${orgId} AND recipient_user_id = ${userId}`);
      await db
        .update(candidateProfiles)
        .set({
          userId: null,
          formerName: identity.name,
          formerUsername: identity.username,
          updatedAt: now,
        })
        .where(
          and(
            eq(candidateProfiles.organizationId, orgId),
            eq(candidateProfiles.id, id),
          ),
        );
      // user_role_assignments and password_reset_tokens cascade.
      await db.execute(sql`
        DELETE FROM users WHERE organization_id = ${orgId} AND id = ${userId}`);
    },
    /**
     * Candidates under the given filters with pagination. Filtering (user
     * name/username search, course-scope enrollment EXISTS) happens in SQL
     * BEFORE limit/offset and BEFORE the total count — never post-pagination;
     * `items` and `total` share one WHERE. EXISTS predicates cannot multiply
     * rows, so multi-enrollment candidates stay single entries. An EMPTY
     * course-id set yields `{ items: [], total: 0 }` by contract.
     * Ordering matches the generic listPaginated (createdAt, id).
     */
    async listFiltered(
      ctx: TenantContext | RequestContext,
      filters: CandidateListFilters,
      pagination: { page: number; pageSize: number },
    ): Promise<{
      items: ActiveCandidateProfile[];
      total: number;
    }> {
      if (filters.courseIds && filters.courseIds.length === 0) {
        return { items: [], total: 0 };
      }
      const orgId = resolveOptionalOrganizationId(ctx);
      const conditions = [eq(candidateProfiles.organizationId, orgId), active];
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        conditions.push(
          exists(
            db
              .select({ id: users.id })
              .from(users)
              .where(
                and(
                  eq(users.organizationId, orgId),
                  eq(users.id, candidateProfiles.userId),
                  sql`(position(lower(${term}) in lower(${users.name})) > 0 or position(lower(${term}) in lower(${users.username})) > 0)`,
                ),
              ),
          ),
        );
      }
      if (filters.courseIds) {
        conditions.push(
          exists(
            db
              .select({ id: examEnrollments.id })
              .from(examEnrollments)
              .innerJoin(exams, eq(examEnrollments.examId, exams.id))
              .where(
                and(
                  eq(examEnrollments.organizationId, orgId),
                  eq(exams.organizationId, orgId),
                  eq(examEnrollments.candidateId, candidateProfiles.id),
                  inArray(exams.courseId, filters.courseIds),
                ),
              ),
          ),
        );
      }
      const where = and(...conditions)!;
      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(candidateProfiles)
          .where(where)
          .orderBy(candidateProfiles.createdAt, candidateProfiles.id)
          .limit(pagination.pageSize)
          .offset(offset),
        db.select({ value: count() }).from(candidateProfiles).where(where),
      ]);
      return {
        items: items as ActiveCandidateProfile[],
        total: Number(totalRows[0]?.value ?? 0),
      };
    },
  };
}
