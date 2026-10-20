// #794 — Production resolution oracle. Complement of the Vitest resolution
// oracles: proves that PLAIN Node (no custom conditions — the way the API
// container, workers and CLI actually execute) resolves and loads every
// workspace package entry from its built artifact, never from TypeScript
// sources, rejects the private/unknown namespace the tests reject, and that
// the compiled artifact trees are complete and current.
//
// Layer 3 of the #794 governance split (see
// docs/architecture/workspace-module-resolution.md — production artifact
// validation). Checks:
//
//   1. entry loading      — every exact exports entry of every workspace
//                           package in the api dependency closure (plus
//                           every non-test file reachable through a pattern
//                           entry) is imported in a child Node process from
//                           the apps/api dependency context; a resolve hook
//                           records the ACTUAL loaded file URL, which must
//                           live under dist/ or built/.
//   2. fixture polarity   — plain Node must observe the BUILT markers,
//                           including the ghost entry (built file exists,
//                           source intentionally absent): production loads
//                           it while Vitest must fail it closed. If both
//                           oracle families ever observe the same marker,
//                           the polarity is broken and neither proves
//                           anything.
//   3. negative namespace — private subpaths, unknown @exam/* packages,
//                           suffixed specifiers and compiled-test specifiers
//                           are REJECTED by plain Node; nothing may fall
//                           through to a loadable artifact.
//   4. artifact hygiene   — dist trees contain no compiled test artifacts,
//                           no orphaned outputs (every dist file has a live
//                           src twin), and .d.ts/.js declarations exist for
//                           every declared entry of every building package.
//
// The specifier→dist mapping is DERIVED from the same authority
// (config/workspace-resolution.mjs) the Vitest plugin uses — one matcher,
// no drift. Requires a prior `pnpm build`.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIST = join(ROOT, "apps/api", "dist");

const failures = [];
const fail = (message) => failures.push(message);
let compiledSpecifierCount = 0;

const authority = await import("../config/workspace-resolution.mjs");
const table = authority.loadWorkspaceResolutionTable();

// ---------------------------------------------------------------------------
// Check 1 + 2: child-process entry loading with a provenance hook.

// The probe runs from the apps/api dependency context (the only package that
// depends on every real workspace package). pnpm's strict layout only makes
// DIRECT dependencies resolvable, so the entry list is restricted to that
// closure — @exam/source-fixture-dep is still exercised transitively: the
// fixture's built entry imports it, and the polarity probe asserts its
// marker through that chain.
const apiManifest = JSON.parse(
  readFileSync(join(ROOT, "apps/api", "package.json"), "utf8"),
);
const probeContextDeps = new Set(
  Object.keys({
    ...(apiManifest.dependencies ?? {}),
    ...(apiManifest.devDependencies ?? {}),
  }),
);

// Build the specifier list: exact entries + every concrete file reachable
// through a pattern entry (the file inventory comes from dist/, so this
// simultaneously verifies the compiled tree is fully exported).
const specifiers = [];
for (const [packageName, pkg] of table.packages) {
  if (!probeContextDeps.has(packageName)) continue;
  const distDir = join(pkg.packageDir, "dist");
  const builtDir = join(pkg.packageDir, "built");
  const artifactRoot = existsSync(distDir) ? distDir : builtDir;
  for (const entry of pkg.exact.values()) {
    if (entry.negative) continue; // ghost: asserted in the polarity probe
    const subpath = entry.key === "" ? "" : `/${entry.key}`;
    specifiers.push(`${packageName}${subpath}`);
    continue;
  }
  for (const pattern of pkg.patterns) {
    if (!existsSync(artifactRoot)) continue; // check 4 reports hygiene
    const bare = pattern.prefix;
    const baseDir = join(artifactRoot, bare);
    if (!existsSync(baseDir)) {
      fail(
        `${packageName} pattern ${pattern.key}: artifact dir ${bare} missing`,
      );
      continue;
    }
    const walk = (dir, rel) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name), join(rel, e.name));
        else if (e.name.endsWith(".js") && !e.name.endsWith(".test.js"))
          specifiers.push(
            `${packageName}/${join(rel, e.name.slice(0, -3)).split("\\").join("/")}`,
          );
      }
    };
    walk(baseDir, bare.replace(/\/$/, ""));
  }
}

const childScript = `
import { registerHooks } from "node:module";
const loaded = new Map();
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (specifier.startsWith("@exam/")) loaded.set(specifier, resolved.url);
    return resolved;
  },
});
const specifiers = JSON.parse(process.env.EXAM_PROBE_SPECS);
for (const spec of specifiers) {
  try {
    await import(spec);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, spec, error: String(err && err.message || err) }));
    process.exit(0);
  }
}
console.log(JSON.stringify({ ok: true, loaded: Object.fromEntries(loaded) }));
`;

// `--input-type=module --eval` resolves bare specifiers from the cwd, so run
// inside apps/api — the one package that depends on every workspace package.
const child = spawnSync(
  process.execPath,
  ["--input-type=module", "--eval", childScript],
  {
    cwd: join(ROOT, "apps/api"),
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, EXAM_PROBE_SPECS: JSON.stringify(specifiers) },
  },
);

if (child.status !== 0 || !child.stdout.trim()) {
  fail(`production probe process failed: ${child.stderr || "no output"}`);
} else {
  const result = JSON.parse(child.stdout.trim().split("\n").pop());
  if (!result.ok) {
    fail(`production Node failed to import ${result.spec}: ${result.error}`);
  } else {
    for (const [spec, url] of Object.entries(result.loaded)) {
      if (url.includes("/src/")) {
        fail(
          `${spec}: production Node loaded SOURCE ${url} — the ${authority.TEST_SOURCE_CONDITION} condition must never be active outside Vitest`,
        );
      }
      if (!/\/(dist|built)\//.test(url)) {
        fail(`${spec}: production Node loaded unexpected artifact ${url}`);
      }
    }
  }
}

// Check 2: fixture polarity — plain Node must observe the BUILT markers,
// including the declared ghost entry (the permanent "dist exists, source
// absent" injection: production loads it, Vitest must reject it).
const polarity = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `const f = await import("@exam/source-fixture");
     const w = await import("@exam/source-fixture/repository/widget");
     const d = await import("@exam/source-fixture/deep/mod");
     const g = await import("@exam/source-fixture/ghost");
     console.log(JSON.stringify({ root: f.SOURCE_FIXTURE_MARKER, widget: w.WIDGET_MARKER, deep: d.DEEP_MOD_MARKER, ghost: g.SOURCE_FIXTURE_GHOST_MARKER }));`,
  ],
  { cwd: join(ROOT, "apps/api"), encoding: "utf8", timeout: 30_000 },
);
if (polarity.status !== 0) {
  fail(`fixture polarity probe failed: ${polarity.stderr}`);
} else {
  const markers = JSON.parse(polarity.stdout.trim());
  const expected = {
    root: "source-fixture:built:root",
    widget: "source-fixture:built:repository/widget",
    deep: "source-fixture:built:deep/mod",
    ghost: "source-fixture:built:ghost",
  };
  for (const [key, marker] of Object.entries(expected)) {
    if (markers[key] !== marker) {
      fail(
        `fixture polarity broken: production Node observed ${key} marker ` +
          `${markers[key]}, expected the built marker ${marker}`,
      );
    }
  }
}

// Check 3: negative namespace — plain Node must reject the same family the
// Vitest oracles reject. Asserted per error code rather than message text:
// ERR_PACKAGE_PATH_NOT_EXPORTED (not exported / physical src) and
// ERR_MODULE_NOT_FOUND (unknown package, wildcard match without artifact).
const negativeProbes = [
  ["@exam/db/not-exported", "ERR_PACKAGE_PATH_NOT_EXPORTED"],
  // Assembled from parts: the physical-src SPECIFIER SHAPE is banned text in
  // active code (lint:arch) — this probe asserts plain Node rejects it, so
  // it must exist at runtime without existing as a literal here.
  [
    ["@exam/db/src", "repository/examRepo"].join("/"),
    "ERR_PACKAGE_PATH_NOT_EXPORTED",
  ],
  ["@exam/nonexistent-794", "ERR_MODULE_NOT_FOUND"],
  ["@exam/db/repository/examRepo.js", "ERR_MODULE_NOT_FOUND"],
  ["@exam/db/repository/examRepo.test", "ERR_MODULE_NOT_FOUND"],
];
const negativeChild = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `const cases = JSON.parse(process.env.EXAM_NEGATIVE_SPECS);
     for (const [spec, expectedCode] of cases) {
       try {
         await import(spec);
         console.log(JSON.stringify({ spec, expectedCode, outcome: "LOADED" }));
         process.exit(0);
       } catch (err) {
         const code = err && err.code ? err.code : "ERR_UNCLASSIFIED";
         if (code !== expectedCode) {
           console.log(JSON.stringify({ spec, expectedCode, outcome: code }));
           process.exit(0);
         }
       }
     }
     console.log(JSON.stringify({ outcome: "ALL_REJECTED" }));`,
  ],
  {
    cwd: join(ROOT, "apps/api"),
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      EXAM_NEGATIVE_SPECS: JSON.stringify(negativeProbes),
    },
  },
);
if (negativeChild.status !== 0) {
  fail(`negative namespace probe process failed: ${negativeChild.stderr}`);
} else {
  const outcome = JSON.parse(negativeChild.stdout.trim());
  if (outcome.outcome !== "ALL_REJECTED") {
    fail(
      `negative namespace: ${outcome.spec} expected ${outcome.expectedCode} ` +
        `but was ${outcome.outcome} — production Node must fail closed on ` +
        `private/unknown/suffixed specifiers`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check 4: artifact hygiene over every building package's dist AND the api
// app dist (review round 2: the api image ships apps/api/dist, so harness
// code compiled from src/testing used to sail into the artifact unwatched).
// Clean-before-compile (scripts/clean-dist.mjs in every build script) makes
// dist the exact output of current sources, so BOTH properties are hard
// assertions:
//   - no compiled test artifacts (tests and test-support harnesses are
//     excluded from build tsconfigs; no exports entry or image layer can
//     ever expose them)
//   - no orphans (every emitted .js/.d.ts has a live src twin — deleted or
//     renamed sources can no longer keep speaking as public API)

// INVARIANT: "testing" is spelled out alongside "test"/"tests" — the api
// harness directory is src/testing, and a bare tests?\/ alternation lets
// exactly that directory sail through (observed live before this fix).
const TEST_ARTIFACT_PATTERN =
  /__tests__|(^|\/)tests?(?:ing)?\/|\.test\.|\.spec\.|\.testHelpers\.|\.mock\./;

function assertArtifactHygiene(label, srcDir, distDir, skipMissing) {
  if (!existsSync(distDir)) {
    if (!skipMissing) {
      fail(`${label}: dist missing — run pnpm build before this oracle`);
    }
    return;
  }
  const walkArtifacts = (dir, fn) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walkArtifacts(p, fn);
      else fn(p);
    }
  };
  walkArtifacts(distDir, (file) => {
    const rel = relative(distDir, file);
    if (TEST_ARTIFACT_PATTERN.test(rel)) {
      fail(
        `${label}: dist contains compiled test artifact ${rel} — ` +
          `build tsconfigs must exclude tests and harnesses (#794)`,
      );
    }
    if (file.endsWith(".js") || file.endsWith(".d.ts")) {
      const srcTwin = join(
        srcDir,
        rel.replace(/\.d\.ts$/, ".ts").replace(/\.js$/, ".ts"),
      );
      if (!existsSync(srcTwin)) {
        fail(
          `${label}: orphaned dist artifact ${rel} (no src twin) — ` +
            `stale build residue; the clean-build lifecycle must prevent this`,
        );
      }
    }
  });
}

for (const [packageName, pkg] of table.packages) {
  const manifest = JSON.parse(
    readFileSync(join(pkg.packageDir, "package.json"), "utf8"),
  );
  if (!manifest.scripts?.build) continue; // never-built fixtures: no dist
  assertArtifactHygiene(
    packageName,
    join(pkg.packageDir, "src"),
    join(pkg.packageDir, "dist"),
    false,
  );
  // Declared-entry completeness: every entry's production targets exist.
  for (const entry of [...pkg.exact.values(), ...pkg.patterns]) {
    if (entry.negative) continue;
    if (entry.defaultTarget.includes("*")) {
      if (
        !existsSync(join(pkg.packageDir, entry.defaultTarget.split("*")[0]))
      ) {
        fail(
          `${packageName}: default target directory for ${entry.key} missing in dist`,
        );
      }
      continue;
    }
    if (
      !existsSync(
        join(pkg.packageDir, entry.defaultTarget.replace(/^\.\//, "")),
      )
    ) {
      fail(
        `${packageName}: default target ${entry.defaultTarget} missing (stale build?)`,
      );
    }
    if (
      !existsSync(join(pkg.packageDir, entry.typesTarget.replace(/^\.\//, "")))
    ) {
      fail(
        `${packageName}: types target ${entry.typesTarget} missing (stale build?)`,
      );
    }
  }
}
assertArtifactHygiene(
  "apps/api",
  join(ROOT, "apps/api", "src"),
  API_DIST,
  true, // missing api dist is reported by the compiled-specifier check below
);

// Compiled-specifier completeness for the api bundle: every "@exam/*"
// specifier in apps/api/dist/**/*.js resolves to an existing file under the
// production default branch. This kills the "tests resolve, production Node
// cannot find the subpath" failure mode statically, before any boot attempt.
if (!existsSync(API_DIST)) {
  fail(`apps/api/dist missing — run pnpm build before this oracle`);
} else {
  const distFiles = [];
  const walkDist = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walkDist(join(dir, e.name));
      else if (e.name.endsWith(".js")) distFiles.push(join(dir, e.name));
    }
  };
  walkDist(API_DIST);
  const compiledSpecifiers = new Set();
  const SPEC = /(?<=["'])@exam\/[a-z-]+(?:\/[A-Za-z0-9_./-]+)?(?=["'])/g;
  for (const file of distFiles) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(SPEC)) compiledSpecifiers.add(m[0]);
  }
  for (const spec of compiledSpecifiers) {
    const match = authority.matchWorkspaceSource(table, spec);
    if (match.status !== "resolved" && match.status !== "error") continue;
    if (match.status === "error") {
      // A compiled api artifact importing a non-resolvable specifier is a
      // real defect — production boot would die on it (review round 2: this
      // includes BAD_SPECIFIER_SHAPE; a suffixed import compiled into the
      // bundle used to be skipped silently here).
      fail(`apps/api/dist imports ${spec} — ${match.message}`);
      continue;
    }
    // match.file points at the SOURCE (the authority is test-rail); derive
    // the production target from the same entry's default branch instead.
    void match;
    const [scope, name, ...rest] = spec.split("/");
    void scope;
    const pkg = table.packages.get(`@exam/${name}`);
    const subpath = rest.join("/");
    const entry =
      pkg.exact.get(subpath) ??
      pkg.patterns.find(
        (p) =>
          subpath.length >= p.prefix.length + p.suffix.length &&
          subpath.startsWith(p.prefix) &&
          subpath.endsWith(p.suffix),
      );
    if (!entry) {
      fail(
        `apps/api/dist imports ${spec} — not exported under the production branch`,
      );
      continue;
    }
    const capture =
      entry.prefix === null
        ? ""
        : subpath.slice(
            entry.prefix.length,
            subpath.length - entry.suffix.length,
          );
    const target = join(
      pkg.packageDir,
      entry.defaultTarget.replace(/^\.\//, "").replace("*", capture),
    );
    if (!existsSync(target)) {
      fail(
        `apps/api/dist imports ${spec} — production target missing (stale build?)`,
      );
    }
  }
  compiledSpecifierCount = compiledSpecifiers.size;
}

if (failures.length > 0) {
  process.stderr.write(
    `Production resolution violations:\n${failures.join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  `Production resolution checks passed (${specifiers.length} entries loaded from dist/built, ` +
    `${compiledSpecifierCount} compiled specifiers verified, negative namespace rejected).\n`,
);
