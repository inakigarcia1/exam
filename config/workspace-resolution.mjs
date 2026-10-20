// #794 — The single authority for workspace module resolution semantics.
// Plain ESM so every consumer imports the SAME implementation: the nine
// Vitest configs (via the plugin), scripts/check-architecture.mjs and
// scripts/check-production-resolution.mjs (via loadWorkspaceResolutionTable /
// matchWorkspaceSource). There is no second matcher anywhere; types for TS
// consumers live in the sibling .d.mts.
//
// Contract: every workspace package under packages/ declares its public API
// in package.json `exports` with exactly three conditions per entry:
//
//   "@exam/test-source"  → the TypeScript source file (dev/test authority)
//   "types"              → the built declaration (production type authority)
//   "default"            → the built JS module (production runtime authority)
//
// Production resolution never activates "@exam/test-source": plain Node
// (API start, workers, CLI, Playwright) and the Vite production build read
// `default`/`types`, so dist stays the only production-loaded code.
//
// In Vitest the plugin below activates the test-source condition in EVERY
// resolution context the test runner uses — worker module graphs (node and
// jsdom pools), the main-process module runner, and vitest globalSetup
// files. Empirically (#794): the module graph honours `resolve.conditions` /
// `ssr.resolve.conditions`, but the main-process runner that loads
// globalSetup ignores both; a pre-enforce resolveId plugin is the one hook
// that fires everywhere, so it is the only activation path.
//
// TEST-TIME RESOLUTION FAILS CLOSED (#794 phase R1). A specifier in the
// governed `@exam/*` namespace is NEVER allowed to fall through to the
// production `default` branch: if the mapped TypeScript source does not
// exist, the plugin throws a classified error instead of letting Vitest's
// own resolver load stale dist behind the test's back (the fail-open
// behaviour this file's fall-through predecessor had — reproduced and
// killed in #794's isolation-worktree experiment). Supported
// classifications, each naming package / specifier / expected source:
//
//   UNKNOWN_WORKSPACE_PACKAGE — @exam/* name with no packages/ manifest
//   NOT_EXPORTED              — package exists, subpath matches no key
//   BAD_SPECIFIER_SHAPE       — a capture Node's exports resolution would
//                               reject before file lookup: extension/test
//                               markers (.js/.ts/.test/…), or ".", "..",
//                               "node_modules", percent-encoded or backslash
//                               path segments (grammar parity, probed live)
//   MISSING_SOURCE            — exports key matches but the source file is
//                               absent (stale-dist trap; declared ghost
//                               entries inject this permanently for the
//                               negative oracles)
//
// Module-load and business errors inside a resolved file are NOT
// classification material — they propagate untouched.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The reserved condition selecting TypeScript sources inside `exports`.
 * Declared once here; every package manifest, the typecheck tsconfigs
 * (customConditions) and the plugin must spell it identically.
 */
export const TEST_SOURCE_CONDITION = "@exam/test-source";

/** Failure classifications the plugin fails closed with. */
export const RESOLUTION_FAILURE_CLASSIFICATIONS = Object.freeze([
  "UNKNOWN_WORKSPACE_PACKAGE",
  "NOT_EXPORTED",
  "BAD_SPECIFIER_SHAPE",
  "MISSING_SOURCE",
]);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PACKAGES_DIR = join(REPO_ROOT, "packages");

/**
 * Manifest-declared fault injection: `workspaceResolution.negativeEntries`
 * lists exports keys whose test-source target is INTENTIONALLY absent. Only
 * packages without a build script (the source fixtures) may declare them;
 * their `default` target must exist so production keeps loading built code
 * while Vitest must always fail the specifier closed.
 */
const NEGATIVE_ENTRIES_FIELD = "workspaceResolution";

// ---------------------------------------------------------------------------
// Table loading + manifest validation. Shared by the plugin, lint:arch and
// the production oracle, so manifest drift fails everywhere identically.

function requireConditionString(conditions, condition, label) {
  const value = conditions[condition];
  if (typeof value !== "string") {
    throw new TypeError(
      `${label}: must declare the "${condition}" condition as a string ` +
        `(three-condition contract: "${TEST_SOURCE_CONDITION}", "types", "default")`,
    );
  }
  return value;
}

function parseKey(rawKey, label) {
  if (rawKey === ".") return { key: "", prefix: null, suffix: null };
  const key = rawKey.replace(/^\.\//, "");
  // INVARIANT (review round 2): an exact key must name a MODULE, not a
  // file — workspace imports never carry extensions or test markers
  // (BAD_SPECIFIER_SHAPE exists for exactly this family), so a manifest
  // key like "./seed.js" or "./foo.test" would create a public API the
  // specifier grammar promises never to serve.
  if (/\.(?:js|mjs|cjs|ts|tsx|jsx)$|\.(?:test|spec)$/i.test(key)) {
    throw new TypeError(
      `${label}: exact keys must not carry file extensions or test markers — ` +
        `declare the module specifier (e.g. "./seed") instead`,
    );
  }
  const stars = key.split("*").length - 1;
  if (stars > 1) {
    throw new TypeError(
      `${label}: pattern keys must contain exactly one "*" (got ${stars}) — ` +
        `unsupported patterns have no Node-faithful matcher here`,
    );
  }
  if (stars === 0) return { key, prefix: null, suffix: null };
  const star = key.indexOf("*");
  return { key, prefix: key.slice(0, star), suffix: key.slice(star + 1) };
}

/**
 * Exports-key matching that mirrors Node's PACKAGE_TARGET_RESOLVE for the
 * supported grammar (exact keys + single-star patterns): exact keys win;
 * among patterns the longest prefix wins, ties broken by the longest
 * suffix. Pattern families must be pairwise prefix-disjoint (validated at
 * load), so "best match" is always unambiguous and no specifier is ever
 * handed to a different resolver as a fallback.
 */
function patternKeyCompare(a, b) {
  if (a.prefix.length !== b.prefix.length) {
    return b.prefix.length - a.prefix.length;
  }
  return b.suffix.length - a.suffix.length;
}

// Grammar parity with Node's exports resolution (#794 round 3, probed live
// on the toolchain Node): inside a pattern capture, ".", ".." and
// "node_modules" segments — raw or percent-encoded in any case — are
// rejected with ERR_INVALID_MODULE_SPECIFIER before any file lookup, as are
// encoded path separators and backslashes. Empty segments and trailing
// slashes are deprecated-but-allowed there and stay allowed here (they can
// only normalize onto a declared file, same as Node). This check must run
// BEFORE any path math: join() normalizes captures, so a rejected shape
// like "repository/../sqlIdent" would otherwise resolve an existing
// undeclared file (observed live: the plugin executed src/sqlIdent.ts while
// both native Node and Vitest's default chain rejected the specifier).
function isInvalidCaptureSegment(segment) {
  const raw = segment.toLowerCase();
  if (
    raw === "." ||
    raw === ".." ||
    raw === "node_modules" ||
    raw.includes("%2f") ||
    raw.includes("%5c") ||
    raw.includes("\\")
  ) {
    return true;
  }
  try {
    const decoded = decodeURIComponent(segment).toLowerCase();
    return decoded === "." || decoded === ".." || decoded === "node_modules";
  } catch {
    // Malformed percent-encoding is not a valid encoded subpath; rejecting
    // it here is the fail-closed direction of the parity rule.
    return true;
  }
}

function validateDisjointPatterns(packageName, patterns) {
  for (let i = 0; i < patterns.length; i += 1) {
    for (let j = i + 1; j < patterns.length; j += 1) {
      const [a, b] = [patterns[i], patterns[j]];
      if (a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix)) {
        throw new TypeError(
          `${packageName}: pattern keys "./${a.prefix}*${a.suffix}" and ` +
            `"./${b.prefix}*${b.suffix}" overlap — best-match would be ` +
            `ambiguous, split or rename one family`,
        );
      }
    }
  }
}

function sourceTargetExists(packageDir, sourceTarget) {
  const relative = sourceTarget.replace(/^\.\//, "");
  if (sourceTarget.includes("*")) {
    // Pattern entries cannot name one file; the directory that will hold
    // the per-capture sources must exist (review round 2: without the
    // trailing ".." this checked the parent and a deleted pattern source
    // directory would only surface later, at resolve time).
    const dir = join(packageDir, relative.split("*")[0]);
    return existsSync(dir);
  }
  return existsSync(join(packageDir, relative));
}

/**
 * Load and validate every workspace package manifest under packages/ into
 * the resolution table. Throws (config-load failure) on any contract
 * violation — a broken manifest must stop the test run and the static
 * gates, not degrade.
 */
export function loadWorkspaceResolutionTable(
  packagesDir = DEFAULT_PACKAGES_DIR,
) {
  const packages = new Map();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(packagesDir, entry.name);
    const manifestPath = join(packageDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!manifest.name || !manifest.exports) {
      throw new TypeError(
        `workspace package ${entry.name} must declare "name" and "exports" ` +
          `(see docs/architecture/workspace-module-resolution.md)`,
      );
    }
    const packageName = manifest.name;
    const negative = new Set(
      manifest[NEGATIVE_ENTRIES_FIELD]?.negativeEntries ?? [],
    );
    if (negative.size > 0 && manifest.scripts?.build) {
      throw new TypeError(
        `${packageName}: ${NEGATIVE_ENTRIES_FIELD}.negativeEntries is fault ` +
          `injection for never-built fixture packages — a package with a ` +
          `build script must ship real sources for every exports key`,
      );
    }
    const exact = new Map();
    const patterns = [];
    for (const [rawKey, value] of Object.entries(manifest.exports)) {
      const label = `${packageName} exports["${rawKey}"]`;
      if (typeof value !== "object" || value === null) {
        throw new TypeError(
          `${label}: plain-string exports cannot separate the test-source ` +
            `condition from production resolution`,
        );
      }
      const sourceTarget = requireConditionString(
        value,
        TEST_SOURCE_CONDITION,
        label,
      );
      const typesTarget = requireConditionString(value, "types", label);
      const defaultTarget = requireConditionString(value, "default", label);
      if (defaultTarget.startsWith("./src/")) {
        throw new TypeError(
          `${label}: "default" must not resolve into src/ — production ` +
            `Node would execute sources`,
        );
      }
      if (typesTarget.startsWith("./src/") && manifest.scripts?.build) {
        throw new TypeError(
          `${label}: "types" must point at built declarations when the ` +
            `package has a build script`,
        );
      }
      const { key, prefix, suffix } = parseKey(rawKey, label);
      const isNegative = negative.has(rawKey) || negative.has(key);
      if (isNegative) {
        // Declared fault injection: the test-source target is intentionally
        // absent, but the production target must exist so the polarity
        // ("dist loadable, source rejected") is real on both rails.
        if (!sourceTarget.startsWith("./src/")) {
          throw new TypeError(
            `${label}: negative entries must point their ` +
              `"${TEST_SOURCE_CONDITION}" target into src/`,
          );
        }
        if (!existsSync(join(packageDir, defaultTarget.replace(/^\.\//, "")))) {
          throw new TypeError(
            `${label}: negative entry's "default" target ${defaultTarget} ` +
              `must exist — production polarity requires loadable dist`,
          );
        }
      } else if (!sourceTargetExists(packageDir, sourceTarget)) {
        throw new TypeError(
          `${label}: "${TEST_SOURCE_CONDITION}" target ${sourceTarget} does ` +
            `not exist`,
        );
      }
      const record = {
        packageDir,
        key,
        prefix,
        suffix,
        sourceTarget,
        typesTarget,
        defaultTarget,
        negative: isNegative,
      };
      if (prefix === null) exact.set(key, record);
      else patterns.push(record);
    }
    for (const declared of negative) {
      const normalized = declared === "." ? "" : declared.replace(/^\.\//, "");
      if (
        !exact.has(normalized) &&
        !patterns.some((p) => p.key === normalized)
      ) {
        throw new TypeError(
          `${packageName}: ${NEGATIVE_ENTRIES_FIELD}.negativeEntries names ` +
            `"${declared}" but exports has no such key`,
        );
      }
    }
    validateDisjointPatterns(packageName, patterns);
    packages.set(packageName, { packageDir, exact, patterns });
  }
  return { packages };
}

let cachedTable;

/** Process-wide table (config files load before workers fork). */
export function getWorkspaceResolutionTable() {
  cachedTable ??= loadWorkspaceResolutionTable();
  return cachedTable;
}

// ---------------------------------------------------------------------------
// Specifier matching — the one matcher, used by the plugin and both checks.

/**
 * Match a workspace specifier against the table.
 * Returns one of:
 *   { status: "unmanaged" }                       — outside @exam/*
 *   { status: "resolved", file }                  — load this source file
 *   { status: "error", classification, message }  — fail closed
 */
export function matchWorkspaceSource(table, specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith("@exam/")) {
    return { status: "unmanaged" };
  }
  const withoutScope = specifier.slice("@exam/".length);
  const slash = withoutScope.indexOf("/");
  const packageName =
    slash === -1 ? withoutScope : withoutScope.slice(0, slash);
  const subpath = slash === -1 ? "" : withoutScope.slice(slash + 1);
  const pkg = table.packages.get(`@exam/${packageName}`);
  if (!pkg) {
    return {
      status: "error",
      classification: "UNKNOWN_WORKSPACE_PACKAGE",
      message:
        `${specifier}: UNKNOWN_WORKSPACE_PACKAGE — no workspace package ` +
        `"@exam/${packageName}" under packages/`,
    };
  }
  let entry;
  let capture = "";
  const exactEntry = pkg.exact.get(subpath);
  if (exactEntry) {
    entry = exactEntry;
  } else {
    const candidates = pkg.patterns
      .filter(
        (p) =>
          subpath.length >= p.prefix.length + p.suffix.length &&
          subpath.startsWith(p.prefix) &&
          subpath.endsWith(p.suffix),
      )
      .sort(patternKeyCompare);
    entry = candidates[0];
    if (entry) {
      capture = subpath.slice(
        entry.prefix.length,
        subpath.length - entry.suffix.length,
      );
    }
  }
  if (!entry) {
    return {
      status: "error",
      classification: "NOT_EXPORTED",
      message:
        `${specifier}: NOT_EXPORTED — package "@exam/${packageName}" does ` +
        `not export "${subpath || "."}" (public API is the exports field ` +
        `of packages/${packageName}/package.json)`,
    };
  }
  if (entry.prefix !== null) {
    // Pattern captures are validated as subpath shapes before any file
    // math (grammar parity, see isInvalidCaptureSegment above).
    const invalidSegment = capture.split("/").find(isInvalidCaptureSegment);
    if (invalidSegment !== undefined) {
      return {
        status: "error",
        classification: "BAD_SPECIFIER_SHAPE",
        message:
          `${specifier}: BAD_SPECIFIER_SHAPE — pattern captures may not ` +
          `contain ".", "..", "node_modules", encoded-separator or ` +
          `backslash path segments (Node exports parity); invalid segment ` +
          `"${invalidSegment}" in capture "${capture}" of "@exam/${packageName}"`,
      };
    }
  }
  if (/\.(?:js|mjs|cjs|ts|tsx|jsx)$|\.(?:test|spec)$/i.test(capture)) {
    return {
      status: "error",
      classification: "BAD_SPECIFIER_SHAPE",
      message:
        `${specifier}: BAD_SPECIFIER_SHAPE — workspace subpaths never carry ` +
        `file extensions or test markers; import "${subpath.replace(
          /\.(?:js|mjs|cjs|ts|tsx|jsx)$|\.(?:test|spec)$/i,
          "",
        )}" instead`,
    };
  }
  const relativeSource = entry.sourceTarget
    .replace(/^\.\//, "")
    .replace("*", capture);
  const candidate = join(entry.packageDir, relativeSource);
  if (entry.negative) {
    return {
      status: "error",
      classification: "MISSING_SOURCE",
      message:
        `${specifier}: MISSING_SOURCE — declared negative entry of ` +
        `"@exam/${packageName}" (source ${relativeSource} is intentionally ` +
        `absent; production loads ${entry.defaultTarget}, tests must fail ` +
        `closed)`,
    };
  }
  if (!existsSync(candidate)) {
    return {
      status: "error",
      classification: "MISSING_SOURCE",
      message:
        `${specifier}: MISSING_SOURCE — exports key matches but source file ` +
        `${relativeSource} does not exist (stale build? deleted or renamed ` +
        `source?). Tests refuse to fall back to dist — rebuild the package.`,
    };
  }
  return { status: "resolved", file: candidate };
}

/**
 * Build the Vitest plugin. Constructed per vitest config; the table is
 * computed once per process (config files load before workers fork).
 */
export function workspaceSourceResolutionPlugin() {
  return {
    name: "exam-workspace-source-resolution",
    enforce: "pre",
    resolveId(source) {
      const match = matchWorkspaceSource(getWorkspaceResolutionTable(), source);
      if (match.status === "unmanaged") return null;
      if (match.status === "resolved") return match.file;
      throw new Error(`[workspace-resolution] ${match.message}`);
    },
  };
}
