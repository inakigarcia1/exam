import { createDatabase } from "@exam/db/database";
import { migratePostgres } from "@exam/db/postgres";
import { seedDemo } from "@exam/db/demo-seed";
import { verifyDemoSeed } from "@exam/db/demo-seed-verify";
import { hashPassword } from "@exam/auth/password";
import { createDemoSeedGrader } from "./demo-seed-grader.js";
import { loadRootEnv } from "./config/loadRootEnv.js";
import { getRuntimeConfig } from "./config/runtimeConfig.js";

loadRootEnv();

const { database } = getRuntimeConfig();
const conn = await createDatabase(database.url);

process.stdout.write("Running migrations...\n");
await migratePostgres(conn.db);

process.stdout.write("Re-seeding demo data for verification...\n");
const ids = await seedDemo(
  conn.db,
  hashPassword,
  createDemoSeedGrader(conn.db),
);

process.stdout.write("Running verification...\n");
const errors = await verifyDemoSeed(conn.db, ids);
if (errors.length > 0) {
  process.stderr.write(`\nVerification FAILED (${errors.length} errors):\n`);
  for (const e of errors) {
    process.stderr.write(`  FAIL: ${e}\n`);
  }
  await conn.sql.end();
  process.exit(1);
}

process.stdout.write("\nAll verifications passed.\n");
await conn.sql.end();
