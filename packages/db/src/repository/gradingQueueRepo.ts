import type { Database } from "../types.js";
import { exams, candidateProfiles, users } from "../schema/pg.js";
import { resolveOrganizationId } from "./baseRepo.js";
import type { TenantContext } from "../types.js";
import type { RequestContext } from "@exam/domain";
import { and, eq, sql } from "drizzle-orm";

type ExamSelect = typeof exams.$inferSelect;
type CandidateSelect = typeof candidateProfiles.$inferSelect;
type CandidateIdentity = { name: string; username: string };

/**
 * Creates a repository for grading-queue specific queries that join
 * attempts with exams, candidates, and manual-grading entries.
 *
 * Keeps the route layer free of schema imports.
 */
export function createGradingQueueRepo(db: Database) {
  return {
    /**
     * Finds an exam by ID, scoped to the tenant.
     */
    async findExamById(
      ctx: TenantContext | RequestContext,
      examId: string,
    ): Promise<ExamSelect | null> {
      const orgId = resolveOrganizationId(ctx);
      const rows = await db
        .select()
        .from(exams)
        .where(and(eq(exams.organizationId, orgId), eq(exams.id, examId)));
      return (rows[0] as ExamSelect | undefined) ?? null;
    },

    /**
     * Finds a candidate profile with the candidate's name and username,
     * scoped to the tenant. A deleted candidate keeps the former identity.
     */
    async findCandidateWithUser(
      ctx: TenantContext | RequestContext,
      candidateId: string,
    ): Promise<{ profile: CandidateSelect; user: CandidateIdentity } | null> {
      const orgId = resolveOrganizationId(ctx);
      const rows = await db
        .select({
          profile: candidateProfiles,
          user: {
            name: sql<string>`coalesce(${users.name}, ${candidateProfiles.formerName}, '')`,
            username: sql<string>`coalesce(${users.username}, ${candidateProfiles.formerUsername}, '')`,
          },
        })
        .from(candidateProfiles)
        .leftJoin(users, eq(candidateProfiles.userId, users.id))
        .where(
          and(
            eq(candidateProfiles.organizationId, orgId),
            eq(candidateProfiles.id, candidateId),
          ),
        );
      return rows[0] ?? null;
    },
  };
}
