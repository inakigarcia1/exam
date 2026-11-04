import { and, eq } from "drizzle-orm";
import type { RequestContext } from "@exam/domain";
import type { Database, TenantContext } from "../types.js";
import { questionImages } from "../schema/pg.js";
import { resolveOrganizationId } from "./baseRepo.js";

/** Image formats accepted for question images (ADR-024). */
export type QuestionImageMimeType = "image/png" | "image/jpeg" | "image/webp";

/**
 * Repository for the append-only `question_images` table. There is
 * deliberately no update or delete: snapshots reference rows by hash.
 */
export function createQuestionImageRepo(db: Database) {
  return {
    /** Stores the bytes once per (organization, sha256); re-uploads are no-ops. */
    async put(
      ctx: TenantContext | RequestContext,
      image: { sha256: string; mimeType: QuestionImageMimeType; bytes: Buffer },
    ): Promise<void> {
      await db
        .insert(questionImages)
        .values({
          organizationId: resolveOrganizationId(ctx),
          sha256: image.sha256,
          mimeType: image.mimeType,
          bytes: image.bytes,
          sizeBytes: image.bytes.length,
        })
        .onConflictDoNothing();
    },

    async exists(
      ctx: TenantContext | RequestContext,
      sha256: string,
    ): Promise<boolean> {
      const rows = await db
        .select({ sha256: questionImages.sha256 })
        .from(questionImages)
        .where(
          and(
            eq(questionImages.organizationId, resolveOrganizationId(ctx)),
            eq(questionImages.sha256, sha256),
          ),
        );
      return rows.length > 0;
    },

    async find(
      ctx: TenantContext | RequestContext,
      sha256: string,
    ): Promise<{ mimeType: string; bytes: Buffer } | null> {
      const rows = await db
        .select({
          mimeType: questionImages.mimeType,
          bytes: questionImages.bytes,
        })
        .from(questionImages)
        .where(
          and(
            eq(questionImages.organizationId, resolveOrganizationId(ctx)),
            eq(questionImages.sha256, sha256),
          ),
        );
      return rows[0] ?? null;
    },
  };
}
