/**
 * Migration 0051 — question images (ADR-024).
 *
 * 1. Refuses to drop `questions.attachments` while any row carries a
 *    non-empty value (an arbitrary URL cannot be mapped to a stored image).
 * 2. With empty attachments it creates `question_images`, `questions.image`
 *    and the generated `image_sha256` FK to the same organization's image.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../database.js";
import { setupIsolatedTestDb, type IsolatedTestDb } from "../testIsolation.js";
import { withTestInfraLifecycleLock } from "../testInfraLock.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "../../migrations/postgres");
const TARGET_TAG = "0051_question_images";

function journalTags(): string[] {
  const raw = readFileSync(resolve(MIGRATIONS_DIR, "meta/_journal.json"), {
    encoding: "utf-8",
  });
  return (JSON.parse(raw) as { entries: { tag: string }[] }).entries.map(
    (e) => e.tag,
  );
}

type SqlDriver = Awaited<ReturnType<typeof createDatabase>>["sql"];

async function executeMigrationFile(
  sql: SqlDriver,
  tag: string,
): Promise<void> {
  const statements = readFileSync(resolve(MIGRATIONS_DIR, `${tag}.sql`), {
    encoding: "utf-8",
  })
    .split("--> statement-breakpoint")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
  await sql.begin(async (tx) => {
    for (const stmt of statements) {
      await tx.unsafe(stmt);
    }
  });
}

const PNG_SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

describe("0051 question images migration (ADR-024)", () => {
  let iso: IsolatedTestDb;
  let conn: Awaited<ReturnType<typeof createDatabase>>;
  let sql: SqlDriver;

  beforeAll(async () => {
    iso = await setupIsolatedTestDb({
      namespace: "migration-0051-question-images",
    });
    conn = await createDatabase(iso.databaseUrl, iso.schemaName);
    sql = conn.sql;
    const tags = journalTags();
    const before = tags.slice(0, tags.indexOf(TARGET_TAG));
    await withTestInfraLifecycleLock(iso.databaseUrl, async () => {
      for (const tag of before) {
        await executeMigrationFile(sql, tag);
      }
    });
    await sql.unsafe(`
      INSERT INTO "organizations" ("id", "name", "display_name", "slug", "created_at", "updated_at")
      VALUES ('org-0051', 'Org', 'Org', 'slug-0051', now(), now()),
             ('org-0051-b', 'Org B', 'Org B', 'slug-0051-b', now(), now())
    `);
    await sql.unsafe(`
      INSERT INTO "questions" ("id", "organization_id", "type", "content",
        "options", "standard_answer", "attachments", "difficulty", "tags",
        "grading_rule", "created_at", "updated_at")
      VALUES ('q-0051', 'org-0051', 'true_false', 'prompt', '[]'::jsonb,
        'true'::jsonb,
        '[{"url":"http://example.test/a.png","type":"image","name":"a"}]'::jsonb,
        1, '[]'::jsonb,
        '{"multiSelectScoring":"all_correct_full","fillBlankMatchMode":"exact"}'::jsonb,
        now(), now())
    `);
  }, 120_000);

  afterAll(async () => {
    await conn?.sql.end();
    await iso?.cleanup();
  }, 30_000);

  it("refuses to drop non-empty attachments", async () => {
    await expect(executeMigrationFile(sql, TARGET_TAG)).rejects.toThrow(
      /attachments/,
    );
  });

  it("migrates once attachments are empty and enforces the same-organization image FK", async () => {
    await sql.unsafe(
      `UPDATE "questions" SET "attachments" = '[]'::jsonb WHERE "id" = 'q-0051'`,
    );
    await executeMigrationFile(sql, TARGET_TAG);

    await sql.unsafe(`
      INSERT INTO "question_images" ("organization_id", "sha256", "mime_type", "bytes", "size_bytes")
      VALUES ('org-0051', '${PNG_SHA}', 'image/png', '\\x89504e47'::bytea, 4),
             ('org-0051-b', '${OTHER_SHA}', 'image/png', '\\x89504e47'::bytea, 4)
    `);

    await sql.unsafe(
      `UPDATE "questions" SET "image" = '{"sha256":"${PNG_SHA}","alt":""}'::jsonb WHERE "id" = 'q-0051'`,
    );
    const rows = await sql.unsafe(
      `SELECT "image_sha256" FROM "questions" WHERE "id" = 'q-0051'`,
    );
    expect(rows[0]?.image_sha256).toBe(PNG_SHA);

    await expect(
      sql.unsafe(
        `UPDATE "questions" SET "image" = '{"sha256":"${OTHER_SHA}","alt":""}'::jsonb WHERE "id" = 'q-0051'`,
      ),
    ).rejects.toThrow(/questions_image_fk/);

    await expect(
      sql.unsafe(`
        INSERT INTO "question_images" ("organization_id", "sha256", "mime_type", "bytes", "size_bytes")
        VALUES ('org-0051', 'not-a-hash', 'image/svg+xml', '\\x00'::bytea, 1)
      `),
    ).rejects.toThrow(/question_images_/);
  });
});
