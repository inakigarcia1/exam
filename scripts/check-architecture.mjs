import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const violations = [];

async function files(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (["dist", "coverage", "node_modules"].includes(entry.name)) continue;
    const target = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await files(target)));
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(target);
  }
  return result;
}

async function forbid(path, patterns) {
  for (const file of await files(path)) {
    if (file.endsWith("testHelpers.ts") || file.includes(".test.")) continue;
    const text = await readFile(file, "utf8");
    for (const [pattern, message] of patterns) {
      if (pattern.test(text)) {
        violations.push(`${relative(".", file)}: ${message}`);
      }
    }
  }
}

await forbid("packages/domain/src", [
  [
    /from ["'](?:fastify|react|drizzle-orm|@exam\/)/,
    "domain must remain a leaf package",
  ],
]);
// authz is the RBAC leaf package (ADR-010-scoped-rbac-architecture.md): no
// fastify/React/Drizzle, and it may only reach @exam/domain, so the permission
// vocabulary stays portable. The enforced importer set is the forbid() list
// below.
await forbid("packages/authz/src", [
  [
    /from ["'](?:fastify|react|drizzle-orm)/,
    "authz must stay a leaf package (no fastify/React/Drizzle)",
  ],
  [
    /from ["']@exam\/(?:db|contracts|auth|exam-engine|import-export)\//,
    "authz may only depend on @exam/domain",
  ],
]);
await forbid("packages/contracts/src", [
  [/from ["']fastify/, "contracts cannot depend on fastify"],
]);
// @exam/auth owns the JWT/password mechanism only (#733 R3): application mode
// and secret policy are resolved by the canonical settings/runtimeConfig
// authority and passed in as explicit arguments, so the package must not read
// the environment itself.
await forbid("packages/auth/src", [
  [
    /process\.env/,
    "auth package must not read process.env — configuration enters as explicit arguments",
  ],
]);
// Runtime mode is resolved by packages/db/src/databaseUrl.ts::parseAppMode and
// nowhere else (#733 R4): a consumer that compares the raw process environment
// re-implements the precedence policy (APP_MODE authoritative, NODE_ENV the
// fallback, an invalid APP_MODE throws) and silently disagrees whenever the
// other input selected the mode — the drift F-05 and F-08 shipped. Consumers
// classify the RESOLVED mode; the resolver reads its `env` parameter, so no
// module needs the direct process form. Scope is the modules that own
// runtime-mode consumers (the API application and the db package).
//
// This pins the direct property form only. A destructured, aliased or
// dynamically keyed read (`const { APP_MODE } = process.env`, `const e =
// process.env; e.APP_MODE`, `process.env[key]`) is out of reach of a textual
// guard and stays a review responsibility.
const runtimeModeRawRead =
  /process\.env\??(?:\.(?:APP_MODE|NODE_ENV)\b|\[["'](?:APP_MODE|NODE_ENV)["']\])/;
for (const moduleDir of ["apps/api/src", "packages/db/src"]) {
  await forbid(moduleDir, [
    [
      runtimeModeRawRead,
      "runtime mode comes from @exam/db parseAppMode — classify the resolved mode instead of reading the raw process env",
    ],
  ]);
}
// Physical dotenv admission belongs to application entrypoints (#733): the
// canonical seam is apps/api's loadRootEnv, mode-gated via parseAppMode.
// packages/db/src is shared mechanism — seed.ts, the E2E seed orchestrator,
// test-isolation helpers — imported by tests, API helpers, and research
// harnesses, so module evaluation must never read a developer .env into
// process.env (the F-06 defect: a module-level dotenv.config() made every
// importer admit the file a second time, even after the managed entrypoint
// had refused it). The one legitimate dotenv consumer in the package is the
// drizzle-kit CLI config, which lives outside src/.
await forbid("packages/db/src", [
  [
    /from ["']dotenv["']|require\(["']dotenv["']\)|dotenv\s*\.\s*config/,
    "shared db mechanism must not admit dotenv sources — entrypoints own source admission",
  ],
]);
await forbid("packages/exam-engine/src", [
  [/from ["']fastify/, "exam-engine cannot depend on fastify"],
  // No explicit cast to the transaction-affine EA capability: the brand symbols
  // are module-private, the only legitimate mint is the canonical seam
  // (lockEnrollmentAndAttempt), and a cast is a forgery bypass.
  [
    /\bas\s+LockedEnrollmentAttemptIdentity\b/,
    "do not cast to LockedEnrollmentAttemptIdentity — mint via lockEnrollmentAndAttempt",
  ],
  // No explicit cast to the narrow opaque Attempt mutation context. Its
  // provenance brand is module-private (deadlineReconciliation.ts); the only
  // legitimate mint is the canonical preparation seam
  // (prepareReconciledAttemptMutation). A cast is a forgery bypass that would
  // defeat the repo-affinity proof. The .testHelpers.ts file is exempt (test
  // harness).
  [
    /\bas\s+ReconciledAttemptMutationContext\b/,
    "do not cast to ReconciledAttemptMutationContext — mint via prepareReconciledAttemptMutation",
  ],
]);
await forbid("apps/api/src", [
  [
    /\bas\s+LockedEnrollmentAttemptIdentity\b/,
    "do not cast to LockedEnrollmentAttemptIdentity — mint via lockEnrollmentAndAttempt",
  ],
  [
    /\bas\s+ReconciledAttemptMutationContext\b/,
    "do not cast to ReconciledAttemptMutationContext — mint via prepareReconciledAttemptMutation",
  ],
]);
await forbid("apps/web/src", [
  [/from ["']@exam\/db/, "web cannot import the database package"],
]);
await forbid("apps/api/src/routes", [
  [
    /\bdb\.(?:select|insert|update|delete)\s*\(/,
    "routes must use repositories",
  ],
  [/from ["']drizzle-orm/, "routes must not import drizzle-orm directly"],
  [
    /from ["']@exam\/db\/schema(\/|["'])/,
    "routes must not import DB schema directly",
  ],
]);

// ---------------------------------------------------------------------------
// #794 — workspace module resolution governance. The unified contract lives
// in docs/architecture/workspace-module-resolution.md; the plugin authority
// is config/workspace-resolution.ts. These checks make the contract
// structural: manifests, vitest projects and active imports cannot drift
// back to per-package aliases, inline workarounds or physical /src/
// specifiers (the #689/#794 stale-dist failure modes).

// The reserved condition name is extracted from the authority module instead
// of being restated here — one source of truth for the identifier.
const authoritySource = await readFile(
  "config/workspace-resolution.ts",
  "utf8",
);
const conditionMatch = authoritySource.match(
  /export const TEST_SOURCE_CONDITION = "([^"]+)"/,
);
if (!conditionMatch) {
  violations.push(
    "config/workspace-resolution.ts: TEST_SOURCE_CONDITION declaration not found",
  );
}
const TEST_SOURCE_CONDITION = conditionMatch?.[1] ?? "@exam/test-source";

async function allCodeFiles(path, extensions) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (["dist", "coverage", "node_modules", ".turbo"].includes(entry.name))
      continue;
    const target = join(path, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await allCodeFiles(target, extensions)));
    } else if (extensions.some((e) => entry.name.endsWith(e))) {
      result.push(target);
    }
  }
  return result;
}

// 1 + 2. Package manifests: every workspace package must declare the
// three-condition exports contract, and every declared source target must
// exist. "default" must never point into src/ — plain Node (API start,
// workers, CLI, Playwright) resolves it, and production must load dist.
for (const entry of await readdir("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join("packages", entry.name);
  const manifest = JSON.parse(
    await readFile(join(pkgDir, "package.json"), "utf8"),
  );
  if (!manifest.exports) {
    violations.push(
      `${pkgDir}/package.json: missing "exports" — every workspace package declares its public API (#794 contract)`,
    );
    continue;
  }
  for (const [key, value] of Object.entries(manifest.exports)) {
    const label = `${pkgDir}/package.json exports["${key}"]`;
    if (typeof value !== "object" || value === null) {
      violations.push(
        `${label}: plain-string exports cannot separate the test-source condition from production resolution`,
      );
      continue;
    }
    const sourceTarget = value[TEST_SOURCE_CONDITION];
    const typesTarget = value.types;
    const defaultTarget = value.default;
    if (
      typeof sourceTarget !== "string" ||
      typeof typesTarget !== "string" ||
      typeof defaultTarget !== "string"
    ) {
      violations.push(
        `${label}: must declare "${TEST_SOURCE_CONDITION}", "types" and "default" conditions — the three-condition contract`,
      );
      continue;
    }
    if (typesTarget.startsWith("./src/") && manifest.scripts?.build) {
      // Packages that build must publish dist declarations; the only
      // src-typed manifests are the never-built source-fixture packages.
      violations.push(
        `${label}: "types" must point at built declarations when the package has a build script`,
      );
    }
    if (defaultTarget.startsWith("./src/")) {
      violations.push(
        `${label}: "default" must not resolve into src/ — production Node would execute sources`,
      );
    }
    // Pattern entries ("./repository/*") cannot name one file; validate the
    // target's directory instead of a literal path.
    if (sourceTarget.includes("*")) {
      const dir = join(
        pkgDir,
        sourceTarget.replace("*", "").replace(/^\.\//, ""),
        "..",
      );
      if (!existsSync(dir)) {
        violations.push(
          `${label}: "${TEST_SOURCE_CONDITION}" target directory ${dir} does not exist`,
        );
      }
    } else if (!existsSync(join(pkgDir, sourceTarget.replace(/^\.\//, "")))) {
      violations.push(
        `${label}: "${TEST_SOURCE_CONDITION}" target ${sourceTarget} does not exist`,
      );
    }
  }
}

// 3. Active code must not import physical package-internal src paths. This
// is specifier-shaped (not a bare grep): it matches imports, dynamic
// imports, vi.mock strings and doc references alike — a physical /src/
// specifier in active code is always a resolution-contract violation.
// Cross-package RELATIVE imports are banned for the same reason: they bypass
// the declared exports contract and load whatever file the path happens to
// name (docs/architecture/workspace-module-resolution.md).
const PHYSICAL_SRC_SPECIFIER = /@exam\/[a-z-]+\/src\//;
const CROSS_PACKAGE_RELATIVE =
  /(?:from|import|require\()\s*["'][^"']*\.\.[/\\]packages[/\\]/;
for (const file of await allCodeFiles("apps", [".ts", ".tsx", ".mjs", ".js"])) {
  if (file.endsWith(".d.ts")) continue;
  const text = await readFile(file, "utf8");
  if (PHYSICAL_SRC_SPECIFIER.test(text)) {
    violations.push(
      `${file}: physical "@exam/*/src/" specifier — import the package's public root/subpath entries instead (#794)`,
    );
  }
  if (CROSS_PACKAGE_RELATIVE.test(text)) {
    violations.push(
      `${file}: cross-package relative import — workspace code reaches other packages only through their public exports (#794)`,
    );
  }
}
for (const dir of ["packages", "config", "scripts"]) {
  for (const file of await allCodeFiles(dir, [".ts", ".tsx", ".mjs", ".js"])) {
    if (file.endsWith(".d.ts")) continue;
    const text = await readFile(file, "utf8");
    if (PHYSICAL_SRC_SPECIFIER.test(text)) {
      violations.push(`${file}: physical "@exam/*/src/" specifier (#794)`);
    }
    if (CROSS_PACKAGE_RELATIVE.test(text)) {
      violations.push(`${file}: cross-package relative import (#794)`);
    }
  }
}

// 4. Every package that ships tests must have a vitest project consuming the
// shared resolution plugin — a new workspace package cannot silently skip
// source-fresh test execution (the exact #794 gap for @exam/db/@exam/auth).
for (const entry of await readdir("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join("packages", entry.name);
  const manifest = JSON.parse(
    await readFile(join(pkgDir, "package.json"), "utf8"),
  );
  if (!manifest.scripts?.test) continue;
  const configPath = join(pkgDir, "vitest.config.ts");
  if (!existsSync(configPath)) {
    violations.push(
      `${configPath}: missing — every tested workspace package needs a vitest project (#794)`,
    );
    continue;
  }
  const configText = await readFile(configPath, "utf8");
  if (!configText.includes("workspaceSourceResolutionPlugin")) {
    violations.push(
      `${configPath}: does not consume workspaceSourceResolutionPlugin — direct vitest runs would resolve workspace packages to dist`,
    );
  }
}
for (const app of ["apps/api", "apps/web"]) {
  const configPath = join(app, "vitest.config.ts");
  const configText = await readFile(configPath, "utf8");
  if (!configText.includes("workspaceSourceResolutionPlugin")) {
    violations.push(
      `${configPath}: does not consume workspaceSourceResolutionPlugin (#794)`,
    );
  }
}

// 5. Every vitest project that consumes the plugin must also carry its
// permanent source-freshness oracle, and the api globalSetup must carry the
// main-process canary — deleting the oracles would otherwise pass every
// static gate and leave the mechanism unproven (review round 1, #794).
const ORACLE_ASSERTION =
  'expect(SOURCE_FIXTURE_MARKER).toBe("source-fixture:src:root")';
for (const entry of await readdir("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join("packages", entry.name);
  const manifest = JSON.parse(
    await readFile(join(pkgDir, "package.json"), "utf8"),
  );
  if (
    !manifest.scripts?.test ||
    !manifest.devDependencies?.["@exam/source-fixture"]
  )
    continue;
  const oraclePath = join(pkgDir, "src/workspaceSourceResolution.test.ts");
  if (!existsSync(oraclePath)) {
    violations.push(
      `${oraclePath}: missing — every plugin-consuming project must pin source freshness with the fixture oracle (#794)`,
    );
    continue;
  }
  const oracleText = await readFile(oraclePath, "utf8");
  if (!oracleText.includes(ORACLE_ASSERTION)) {
    violations.push(
      `${oraclePath}: does not assert the fixture src marker — execution provenance assertion missing (#794)`,
    );
  }
}
for (const app of ["apps/api", "apps/web"]) {
  const oraclePath = join(app, "src/workspaceSourceResolution.test.ts");
  if (
    !existsSync(oraclePath) ||
    !(await readFile(oraclePath, "utf8")).includes(ORACLE_ASSERTION)
  ) {
    violations.push(
      `${oraclePath}: missing or incomplete fixture oracle (#794)`,
    );
  }
}
const apiGlobalSetup = await readFile("apps/api/vitest.globalSetup.ts", "utf8");
if (
  !apiGlobalSetup.includes(
    'SOURCE_FIXTURE_MARKER !== "source-fixture:src:root"',
  )
) {
  violations.push(
    "apps/api/vitest.globalSetup.ts: main-process source-resolution canary missing (#794)",
  );
}

// 6. The api typecheck config must activate the same reserved condition the
// plugin does — otherwise type evidence silently reverts to dist .d.ts when
// the authority renames the condition (review round 1, #794).
const apiTypecheck = await readFile("apps/api/tsconfig.typecheck.json", "utf8");
if (!apiTypecheck.includes(`"${TEST_SOURCE_CONDITION}"`)) {
  violations.push(
    "apps/api/tsconfig.typecheck.json: customConditions must contain the TEST_SOURCE_CONDITION from config/workspace-resolution.ts",
  );
}

if (violations.length > 0) {
  process.stderr.write(`Architecture violations:\n${violations.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Architecture checks passed.\n");
