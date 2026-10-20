// #794 — Production resolution oracle. Complement of the Vitest
// source-freshness oracles: proves that PLAIN Node (no custom conditions —
// the way the API container, workers and CLI actually execute) resolves and
// loads every workspace package entry from its built artifact, never from
// TypeScript sources, and that every "@exam/*" specifier compiled into
// apps/api/dist resolves under the production "default" exports branch.
//
// Three checks:
//   1. entry loading  — every exact exports entry of every workspace package
//      (plus every file reachable through pattern entries) is imported in a
//      child Node process from the apps/api dependency context; a resolve
//      hook records the ACTUAL loaded file URL.
//   2. fixture polarity — the source-fixture packages must expose their
//      built markers under plain Node. The Vitest oracles assert the src
//      markers; if both ever pass with the same marker the polarity is
//      broken and neither oracle proves anything.
//   3. compiled-specifier completeness — every "@exam/*" specifier in
//      apps/api/dist/**/*.js (server bundle, workers, CLI scripts) resolves
//      to an existing file via the package's default condition. This kills
//      the "tests resolve, production Node cannot find the subpath"
//      failure mode statically, before any boot attempt.
//
// Real process startup (API listen, worker loops) stays with the e2e/smoke
// lanes (docs/standards/testing.md); this oracle owns module-resolution
// correctness. Requires a prior `pnpm build`.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(ROOT, "packages");
const API_DIST = join(ROOT, "apps/api/dist");
const CONDITION = "@exam/test-source";

const failures = [];
const fail = (message) => failures.push(message);
let compiledSpecifierCount = 0;

// ---------------------------------------------------------------------------
// Shared manifest reading (mirrors config/workspace-resolution.ts matching).
// Deliberately re-derived here instead of imported: this script must run as
// plain Node against the manifests, with zero transpilation, exactly like
// the production consumers it vouches for.

function readManifests() {
  const manifests = [];
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = join(PACKAGES_DIR, entry.name);
    const manifest = JSON.parse(
      readFileSync(join(pkgDir, "package.json"), "utf8"),
    );
    if (!manifest.name || !manifest.exports) {
      fail(`${pkgDir}/package.json: missing name/exports`);
      continue;
    }
    manifests.push({ pkgDir, manifest });
  }
  return manifests;
}

/** Resolve a specifier against the production ("default") branch only. */
function resolveProduction(manifest, pkgDir, subpath) {
  const keys = Object.keys(manifest.exports);
  const normalized = subpath === "" ? "." : `./${subpath}`;
  if (keys.includes(normalized)) {
    const target = manifest.exports[normalized]?.default;
    return typeof target === "string" ? { target, pattern: false } : null;
  }
  for (const [key, value] of Object.entries(manifest.exports)) {
    if (!key.includes("*")) continue;
    const [prefix, suffix] = key.split("*");
    const bare = key.replace(/^\.\//, "").replace("*", "");
    const sub = subpath;
    if (
      sub.startsWith(bare) &&
      sub.length >= bare.length + (suffix?.length ?? 0) &&
      sub.endsWith(suffix ?? "")
    ) {
      const capture = sub.slice(
        bare.length,
        sub.length - (suffix?.length ?? 0),
      );
      void prefix;
      const target = value?.default;
      return typeof target === "string"
        ? { target: target.replace("*", capture), pattern: true }
        : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Check 1 + 2: child-process entry loading with a provenance hook.

const manifests = readManifests();

// The probe runs from the apps/api dependency context (the only package that
// depends on every real workspace package). pnpm's strict layout only makes
// DIRECT dependencies resolvable, so the entry list is restricted to that
// closure — @exam/source-fixture-dep is still exercised transitively: the
// fixture's built entry imports it, and the polarity probe asserts its
// marker through that chain.
const apiManifest = JSON.parse(
  readFileSync(join(ROOT, "apps/api/package.json"), "utf8"),
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
for (const { pkgDir, manifest } of manifests) {
  if (!probeContextDeps.has(manifest.name)) continue;
  const distDir = join(pkgDir, "dist");
  for (const [key, value] of Object.entries(manifest.exports)) {
    if (typeof value !== "object" || value === null) continue;
    if (!key.includes("*")) {
      const subpath = key === "." ? "" : key.slice(2);
      specifiers.push(`${manifest.name}${subpath ? `/${subpath}` : ""}`);
      continue;
    }
    if (!existsSync(distDir)) continue; // reported by check 3's build guard
    const bare = key.replace(/^\.\//, "").split("*")[0];
    const suffix = key.split("*")[1] ?? "";
    const baseDir = join(distDir, bare);
    if (!existsSync(baseDir)) {
      fail(`${manifest.name} pattern ${key}: dist directory ${bare} missing`);
      continue;
    }
    const walk = (dir, rel) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name), join(rel, e.name));
        else if (e.name.endsWith(".js") && !e.name.endsWith(".test.js"))
          specifiers.push(
            `${manifest.name}/${join(rel, e.name.slice(0, -3)).split("\\").join("/")}`,
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
          `${spec}: production Node loaded SOURCE ${url} — the ${CONDITION} condition must never be active outside Vitest`,
        );
      }
      if (!/\/(dist|built)\//.test(url)) {
        fail(`${spec}: production Node loaded unexpected artifact ${url}`);
      }
    }
    // Check 2: fixture polarity — plain Node must observe the BUILT markers.
    const polarity = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const f = await import("@exam/source-fixture");
         const w = await import("@exam/source-fixture/repository/widget");
         console.log(JSON.stringify({ root: f.SOURCE_FIXTURE_MARKER, widget: w.WIDGET_MARKER }));`,
      ],
      { cwd: join(ROOT, "apps/api"), encoding: "utf8", timeout: 30_000 },
    );
    if (polarity.status !== 0) {
      fail(`fixture polarity probe failed: ${polarity.stderr}`);
    } else {
      const markers = JSON.parse(polarity.stdout.trim());
      if (markers.root !== "source-fixture:built:root") {
        fail(
          `fixture polarity broken: production Node observed root marker ${markers.root}, expected the built marker`,
        );
      }
      if (markers.widget !== "source-fixture:built:repository/widget") {
        fail(
          `fixture polarity broken: production Node observed widget marker ${markers.widget}, expected the built marker`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3: every @exam/* specifier compiled into apps/api/dist resolves
// under the production branch. dist files WITHOUT a live src twin are
// orphaned artifacts of older builds (tsc does not clean dist; deleted or
// renamed sources leave their outputs behind — CI's clean checkout never
// produces them and no live entry can reach them), so they are counted and
// skipped rather than treated as resolution violations.

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
  let orphanArtifacts = 0;
  const compiledSpecifiers = new Set();
  const SPEC = /(?<=["'])@exam\/[a-z-]+(?:\/[A-Za-z0-9_./-]+)?(?=["'])/g;
  for (const file of distFiles) {
    const srcTwin = file
      .replace(`${API_DIST}`, join(ROOT, "apps/api/src"))
      .replace(/\.js$/, ".ts");
    if (!existsSync(srcTwin)) {
      orphanArtifacts += 1;
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(SPEC)) compiledSpecifiers.add(m[0]);
  }
  const byName = new Map(manifests.map((m) => [m.manifest.name, m]));
  for (const spec of compiledSpecifiers) {
    const [scope, name, ...rest] = spec.split("/");
    void scope;
    const pkgName = `@exam/${name}`;
    const subpath = rest.join("/");
    const entry = byName.get(pkgName);
    if (!entry) {
      fail(`apps/api/dist imports ${spec} — no such workspace package`);
      continue;
    }
    const resolved = resolveProduction(entry.manifest, entry.pkgDir, subpath);
    if (!resolved) {
      fail(
        `apps/api/dist imports ${spec} — not exported under the production branch`,
      );
      continue;
    }
    const target = join(entry.pkgDir, resolved.target);
    if (!existsSync(target)) {
      fail(
        `apps/api/dist imports ${spec} — production target ${resolved.target} missing (stale build?)`,
      );
    }
  }
  if (orphanArtifacts > 0) {
    process.stdout.write(
      `note: ${orphanArtifacts} orphaned dist artifacts skipped (no live src twin — stale local build residue)\n`,
    );
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
    `${compiledSpecifierCount} compiled specifiers verified).\n`,
);
