// #798 — Deployed payload artifact oracle. Complement of
// scripts/check-production-resolution.mjs: that oracle proves the WORKSPACE
// build artifacts (host repo dist trees); this one proves the DEPLOYED
// runtime payload — the directory `pnpm --filter @exam/api --prod deploy
// --legacy` produces (Dockerfile builder → /out) or the `/app` tree
// extracted from a built production image (`docker cp <cid>:/app <dir>`).
//
// It enforces the runtime artifact contract as an executable allowlist over
// the REAL file tree, never over package.json declarations alone:
//
//   positive — the payload is complete:
//     1. compiled server, migration script, and every manifest script that
//        executes `node dist/**` resolve to existing payload files
//     2. @exam/db migrations: payload journal equals the repository journal
//        (same tags, same order, no strays) and every tagged SQL file exists
//     3. every runtime dependency of the deployed manifest is present in the
//        payload node_modules (symlinks resolve inside the payload)
//     4. every @exam/* production export target exists in the payload
//     5. every @exam/* specifier compiled into the payload dist resolves to
//        an existing production default-branch artifact
//     6. the native addon (argon2) ships a loadable binding for this platform
//
//   negative — the payload carries nothing else:
//     7. payload root entries are allowlisted (dist, node_modules,
//        package.json, packlist metadata, the image entrypoint script)
//     8. no TypeScript sources, tests, coverage, tool configs (.turbo,
//        vitest*, tsconfig*, drizzle.config*) or compiled test artifacts in
//        the app root or any @exam/* package copy
//     9. no .env* files anywhere in the payload (path check only — values
//        are never read)
//    10. no dev toolchain packages (tsx, typescript, vitest, vite, esbuild,
//        drizzle-kit, @types/*, msw) in the dependency store
//
// The specifier→artifact mapping is DERIVED from the same authority
// (config/workspace-resolution.mjs) the Vitest plugin and the host oracle
// use — one matcher, no drift. package.json / README / LICENSE are retained
// by the npm/pnpm packlist by design (docs/architecture/
// workspace-module-resolution.md keeps that out of scope for `files`);
// everything else in the payload must be on this contract.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

const usage = `usage: node scripts/check-deploy-payload.mjs <payload-dir> [--repo <repo-root>]`;
const positional = process.argv
  .slice(2)
  .filter((a, i, arr) => a !== "--repo" && arr[i - 1] !== "--repo");
if (positional.length < 1) {
  process.stderr.write(`${usage}\n`);
  process.exit(2);
}
const PAYLOAD = resolve(positional[0]);
const repoIdx = process.argv.indexOf("--repo");
const REPO = repoIdx === -1 ? ROOT : resolve(process.argv[repoIdx + 1]);

if (!existsSync(PAYLOAD)) {
  process.stderr.write(`payload directory does not exist: ${PAYLOAD}\n`);
  process.exit(2);
}

const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------------------
// Shared traversal: physical @exam/* copies inside the payload store.

const EXAM_PHYS_DIRS = [];
const pnpmExamParent = join(PAYLOAD, "node_modules", ".pnpm");
if (existsSync(pnpmExamParent)) {
  for (const e of readdirSync(pnpmExamParent, { withFileTypes: true })) {
    if (!e.isDirectory() || !e.name.startsWith("@exam+")) continue;
    const phys = join(
      pnpmExamParent,
      e.name,
      "node_modules",
      "@exam",
      e.name.split("+")[1].split("@")[0],
    );
    if (existsSync(phys)) EXAM_PHYS_DIRS.push(phys);
  }
}
// Linked view (node_modules/@exam/*) resolves into the same physical copies;
// negative scans below run once per PHYSICAL directory to avoid double counts.

function walkFiles(dir, fn) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue; // links are validated by resolvability checks
    if (e.isDirectory()) walkFiles(p, fn);
    else fn(p);
  }
}

// ---------------------------------------------------------------------------
// Positive 1: compiled entrypoints + every manifest `node dist/**` script.

const manifestPath = join(PAYLOAD, "package.json");
if (!existsSync(manifestPath)) {
  fail("payload package.json missing");
}
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : {};

for (const rel of ["dist/server.js", "dist/scripts/migrate.js"]) {
  if (!existsSync(join(PAYLOAD, rel)))
    fail(`runtime entrypoint missing: ${rel}`);
}
for (const [name, cmd] of Object.entries(manifest.scripts ?? {})) {
  const match =
    typeof cmd === "string" ? cmd.match(/^node (dist\/[\w./-]+\.js)$/) : null;
  if (match && !existsSync(join(PAYLOAD, match[1]))) {
    fail(`manifest script "${name}" runs ${match[1]} — missing from payload`);
  }
}

// ---------------------------------------------------------------------------
// Positive 2: @exam/db migration assets — payload journal must equal the
// repository journal and carry every tagged SQL file. The repository copy is
// the authority for version ORDER; the payload must be its exact projection.

const DB_MIGRATIONS_REPO = join(
  REPO,
  "packages",
  "db",
  "migrations",
  "postgres",
);
const dbPhys =
  EXAM_PHYS_DIRS.find((d) => d.endsWith(`${sep}db`)) ??
  join(PAYLOAD, "node_modules", "@exam", "db");
const payloadMigrations = join(dbPhys, "migrations", "postgres");
const repoJournalPath = join(DB_MIGRATIONS_REPO, "meta", "_journal.json");
const payloadJournalPath = join(payloadMigrations, "meta", "_journal.json");

if (!existsSync(repoJournalPath)) {
  fail(`repository journal missing (repo root wrong?): ${repoJournalPath}`);
} else if (!existsSync(payloadJournalPath)) {
  fail(
    "payload missing node_modules/@exam/db/migrations/postgres/meta/_journal.json — " +
      "migrations would fail on a fresh database; @exam/db files must include migrations/postgres",
  );
} else {
  const repoTags = JSON.parse(
    readFileSync(repoJournalPath, "utf8"),
  ).entries.map((e) => e.tag);
  const payloadTags = JSON.parse(
    readFileSync(payloadJournalPath, "utf8"),
  ).entries.map((e) => e.tag);
  if (JSON.stringify(repoTags) !== JSON.stringify(payloadTags)) {
    fail(
      `migration journal drift — repository tags [${repoTags.join(", ")}] vs ` +
        `payload tags [${payloadTags.join(", ")}] (order-sensitive)`,
    );
  }
  for (const tag of payloadTags) {
    if (!existsSync(join(payloadMigrations, `${tag}.sql`))) {
      fail(`migration SQL missing from payload: ${tag}.sql`);
    }
  }
  const payloadSql = new Set(
    readdirSync(payloadMigrations).filter((f) => f.endsWith(".sql")),
  );
  for (const file of payloadSql) {
    if (!payloadTags.some((tag) => `${tag}.sql` === file)) {
      fail(`stray migration SQL in payload (not in journal): ${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Positive 3: every runtime dependency resolves inside the payload.

for (const dep of Object.keys(manifest.dependencies ?? {})) {
  if (!existsSync(join(PAYLOAD, "node_modules", dep))) {
    fail(`runtime dependency missing from payload node_modules: ${dep}`);
  }
}

// ---------------------------------------------------------------------------
// Positive 4 + 5: @exam/* export completeness and compiled-specifier
// resolvability over the payload tree. Same authority/matcher as the host
// production-resolution oracle; the traversal targets the payload instead of
// the workspace dist.

const authority = await import(
  join(ROOT, "config", "workspace-resolution.mjs")
);
const table = authority.loadWorkspaceResolutionTable();

function examManifestExports(pkgDir) {
  const p = join(pkgDir, "package.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

for (const phys of EXAM_PHYS_DIRS) {
  const name = relative(join(PAYLOAD, "node_modules"), phys)
    .split(sep)
    .join("/");
  const m = name.match(/@exam\/([a-z-]+)$/);
  if (!m) continue;
  const pkgName = `@exam/${m[1]}`;
  const pkgManifest = examManifestExports(phys);
  if (!pkgManifest) {
    fail(`${pkgName}: package.json missing from payload copy`);
    continue;
  }
  const pkg = table.packages.get(pkgName);
  if (!pkg) continue; // not a governed production package
  for (const entry of [...pkg.exact.values(), ...pkg.patterns]) {
    if (entry.negative) continue;
    const target = entry.defaultTarget.replace(/^\.\//, "");
    if (target.includes("*")) {
      const baseDir = join(phys, target.split("*")[0]);
      if (!existsSync(baseDir)) {
        fail(
          `${pkgName}: production target directory ${target.split("*")[0]} missing from payload`,
        );
      }
      continue;
    }
    if (!existsSync(join(phys, target))) {
      fail(`${pkgName}: production target ${target} missing from payload`);
    }
  }
}

const apiDist = join(PAYLOAD, "dist");
if (existsSync(apiDist)) {
  const distFiles = [];
  walkFiles(apiDist, (f) => {
    if (f.endsWith(".js")) distFiles.push(f);
  });
  const SPEC = /(?<=["'])@exam\/[a-z-]+(?:\/[A-Za-z0-9_./-]+)?(?=["'])/g;
  const compiled = new Set();
  for (const file of distFiles) {
    for (const m of readFileSync(file, "utf8").matchAll(SPEC))
      compiled.add(m[0]);
  }
  for (const spec of compiled) {
    const resolved = authority.resolveProductionArtifact(table, spec);
    if (resolved.status === "unmanaged") continue; // not a governed specifier
    if (resolved.status === "error") {
      fail(
        `payload dist imports ${spec} — ${resolved.classification}: ${resolved.message}`,
      );
      continue;
    }
    // The resolved target lives under the WORKSPACE package dir; the payload
    // carries the same relative layout inside its @exam/* store copy.
    const phys =
      EXAM_PHYS_DIRS.find((d) => d.endsWith(`${sep}${resolved.pkg}`)) ??
      join(PAYLOAD, "node_modules", resolved.pkg);
    const target = join(phys, relative(resolved.packageDir, resolved.target));
    if (!existsSync(target)) {
      fail(
        `payload dist imports ${spec} — production artifact missing: ${relative(PAYLOAD, target)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Positive 6: native addon binding for this platform (argon2 is the only
// native production dependency — pnpm-workspace.yaml allowBuilds).

let argon2Dir = null;
if (
  existsSync(pnpmExamParent) ||
  existsSync(join(PAYLOAD, "node_modules", ".pnpm"))
) {
  const store = join(PAYLOAD, "node_modules", ".pnpm");
  for (const e of readdirSync(store, { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith("argon2@")) {
      argon2Dir = join(store, e.name, "node_modules", "argon2");
      break;
    }
  }
}
if (!argon2Dir) {
  fail(
    "argon2 package missing from payload store — password hashing would fail at runtime",
  );
} else {
  const prebuild = join(
    argon2Dir,
    "prebuilds",
    `${process.platform}-${process.arch}`,
  );
  const hasPrebuild =
    existsSync(prebuild) &&
    readdirSync(prebuild).some((f) => f.endsWith(".node"));
  const hasBuilt =
    existsSync(join(argon2Dir, "build", "Release")) &&
    readdirSync(join(argon2Dir, "build", "Release")).some((f) =>
      f.endsWith(".node"),
    );
  if (!hasPrebuild && !hasBuilt) {
    fail(
      `argon2 native binding missing for ${process.platform}-${process.arch}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Negative 7: payload root allowlist.
//
// `data` is not a deploy artifact: the Dockerfile runner stage creates
// /app/data as the image-owned runtime data mountpoint. It appears in image
// extractions only, never in a bare `pnpm deploy` output — its presence is
// allowed; its absence is not asserted.

const ROOT_ALLOW =
  /^(dist|node_modules|data|package\.json|docker-entrypoint\.sh)$/;
const ROOT_ALLOW_META = /^(README(\..+)?|LICENSE|LICENCE(\..+)?)$/;
for (const e of readdirSync(PAYLOAD, { withFileTypes: true })) {
  if (ROOT_ALLOW.test(e.name) || ROOT_ALLOW_META.test(e.name)) continue;
  fail(
    `payload root carries non-contract entry: ${e.name} (allowlist: dist, node_modules, package.json, packlist metadata, entrypoint)`,
  );
}

// ---------------------------------------------------------------------------
// Negative 8: sources, tests, tool configs — app root and every @exam copy.

const TS_SOURCE = /\.(ts|tsx|mts|cts)$/;
const TEST_ARTIFACT =
  /__tests__|(^|\/)tests?(?:ing)?\/|\.test\.|\.spec\.|\.testHelpers\.|\.mock\./;
const TOOL_CONFIG = /^(\.turbo|coverage|vitest\.|tsconfig|drizzle\.config)/;

// Inside dist the only extra content rule is "no compiled test artifacts" —
// the same single pattern the host oracle (check-production-resolution.mjs)
// enforces over workspace dist trees. Directory-name bans (src/, tests/,
// coverage/) do not apply there: dist deliberately carries compiled
// entrypoints like @exam/db's dist/testHelpers (a declared export) and the
// #794-pinned incremental state file dist/tsconfig.build.tsbuildinfo.
function scanDistFiles(label, dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      scanDistFiles(label, p);
      continue;
    }
    if (TEST_ARTIFACT.test(e.name)) {
      fail(`${label}: compiled test artifact in dist: ${e.name}`);
    }
  }
}

function scanForbidden(label, dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    // Third-party dependencies are out of contract scope here (they are
    // audited as THIRD_PARTY_DEPENDENCY in the payload inventory); the
    // @exam/* production packages are scanned through their PHYSICAL store
    // copies instead of the linked view, so never descend into node_modules.
    if (e.name === "node_modules") continue;
    if (e.name === "dist" && e.isDirectory()) {
      scanDistFiles(label, join(dir, e.name));
      continue;
    }
    if (TOOL_CONFIG.test(e.name) && !/\.tsbuildinfo$/.test(e.name)) {
      fail(`${label}: tool config/dir present: ${e.name}`);
      continue;
    }
    const p = join(dir, e.name);
    if (e.name === "src" && e.isDirectory()) {
      fail(`${label}: source directory present: src/`);
      continue;
    }
    if (e.isDirectory()) {
      if (/^(tests?|__tests__|testHelpers|coverage)$/.test(e.name)) {
        fail(`${label}: test/coverage directory present: ${e.name}/`);
        continue;
      }
      scanForbidden(label, p);
      continue;
    }
    if (TS_SOURCE.test(e.name) && !e.name.endsWith(".d.ts")) {
      fail(`${label}: TypeScript source present: ${e.name}`);
      continue;
    }
    if (TEST_ARTIFACT.test(e.name)) {
      fail(`${label}: test artifact present: ${e.name}`);
    }
  }
}

scanForbidden("app-root", PAYLOAD);
for (const phys of EXAM_PHYS_DIRS) {
  scanForbidden(relative(PAYLOAD, phys).split(sep).join("/"), phys);
}

// ---------------------------------------------------------------------------
// Negative 9: env files anywhere in the payload (paths only, never content).

walkFiles(PAYLOAD, (f) => {
  const base = f.split(sep).pop();
  if (base === ".env" || base.startsWith(".env.")) {
    fail(`env file present in payload: ${relative(PAYLOAD, f)}`);
  }
});

// ---------------------------------------------------------------------------
// Negative 10: dev toolchain packages in the dependency store.

const DEV_TOOL_STORE =
  /^(tsx|typescript|vitest|vite|esbuild|drizzle-kit|msw)(@|$)|^@types\+|^@vitest\+/;
if (existsSync(join(PAYLOAD, "node_modules", ".pnpm"))) {
  for (const e of readdirSync(join(PAYLOAD, "node_modules", ".pnpm"), {
    withFileTypes: true,
  })) {
    if (e.isDirectory() && DEV_TOOL_STORE.test(e.name)) {
      fail(`dev toolchain package in payload store: ${e.name}`);
    }
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  process.stderr.write(
    `Deploy payload contract violations (${failures.length}):\n${failures.join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  `Deploy payload contract passed: ${PAYLOAD}\n` +
    `  (${EXAM_PHYS_DIRS.length} workspace package copies, ` +
    `${JSON.parse(readFileSync(join(REPO, "packages/db/migrations/postgres/meta/_journal.json"), "utf8")).entries.length} migrations verified, ` +
    `entries + compiled specifiers resolvable, negative scans clean)\n`,
);
