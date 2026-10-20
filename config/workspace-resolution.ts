import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * #794 — The single authority for workspace module resolution semantics.
 *
 * Every workspace package under packages/ declares its public API in
 * package.json `exports` with exactly three conditions per entry:
 *
 *   "@exam/test-source"  → the TypeScript source file (dev/test authority)
 *   "types"              → the built declaration (production type authority)
 *   "default"            → the built JS module (production runtime authority)
 *
 * Production resolution never activates "@exam/test-source": plain Node
 * (API start, workers, CLI, Playwright) and the Vite production build read
 * `default`/`types`, so dist stays the only production-loaded code.
 *
 * In Vitest, this plugin activates the test-source condition in EVERY
 * resolution context the test runner uses — worker module graphs (node and
 * jsdom pools), the main-process module runner, and vitest globalSetup
 * files. Empirically (R1 experiments, #794): the module graph honours
 * `resolve.conditions` / `ssr.resolve.conditions`, but the main-process
 * runner that loads globalSetup resolves with Vite's default condition set
 * and ignores both. A pre-enforce resolveId plugin is the one mechanism
 * that fires in all of these contexts, so it is the only activation path —
 * there is deliberately no conditions-based duplicate and no per-package
 * alias/inline list (the retired #689 mechanisms).
 *
 * The specifier→source mapping is DERIVED from the same `exports` manifests
 * at config-load time. A newly added workspace package is covered as soon
 * as it follows the three-condition contract; scripts/check-architecture.mjs
 * enforces that every package does.
 */

/**
 * The reserved condition selecting TypeScript sources inside `exports`.
 * Declared once here; every package manifest, the api typecheck config
 * (customConditions) and this plugin must spell it identically.
 */
export const TEST_SOURCE_CONDITION = "@exam/test-source";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

interface SourceMapping {
  /** Directory of the package whose exports produced this mapping. */
  packageDir: string;
  /** exports key without the leading "./" — e.g. ".", "repository/*". */
  key: string;
  /** Static prefix before the "*" for pattern keys, else null. */
  prefix: string | null;
  /** Static suffix after the "*" for pattern keys, else null. */
  suffix: string | null;
  /** The "@exam/test-source" target, e.g. "./src/repository/*.ts". */
  sourceTarget: string;
}

interface WorkspaceResolutionTable {
  /** @exam/<name> → mappings for that package's exports entries. */
  byPackage: Map<string, SourceMapping[]>;
}

let cachedTable: WorkspaceResolutionTable | undefined;

function buildTable(): WorkspaceResolutionTable {
  const byPackage = new Map<string, SourceMapping[]>();
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(PACKAGES_DIR, entry.name);
    const manifestPath = join(packageDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      exports?: Record<string, unknown>;
    };
    if (!manifest.name || !manifest.exports) {
      throw new Error(
        `workspace package ${entry.name} must declare "name" and "exports" ` +
          `(see docs/architecture/workspace-module-resolution.md)`,
      );
    }
    const mappings: SourceMapping[] = [];
    for (const [rawKey, value] of Object.entries(manifest.exports)) {
      if (typeof value !== "object" || value === null) {
        throw new Error(
          `${manifest.name} exports["${rawKey}"] must be a condition object ` +
            `with "${TEST_SOURCE_CONDITION}", "types" and "default" — plain ` +
            `string exports cannot separate test-source from production resolution`,
        );
      }
      const conditions = value as Record<string, unknown>;
      const sourceTarget = conditions[TEST_SOURCE_CONDITION];
      if (typeof sourceTarget !== "string") {
        throw new Error(
          `${manifest.name} exports["${rawKey}"] is missing the ` +
            `"${TEST_SOURCE_CONDITION}" condition`,
        );
      }
      // INVARIANT: the root entry's exports key is exactly "." — normalize
      // it to "" so it matches the subpath extracted from a bare
      // "packages/<name>" specifier (no slash, subpath "").
      const key = rawKey === "." ? "" : rawKey.replace(/^\.\//, "");
      const star = key.indexOf("*");
      mappings.push({
        packageDir,
        key,
        prefix: star === -1 ? null : key.slice(0, star),
        suffix: star === -1 ? null : key.slice(star + 1),
        sourceTarget,
      });
    }
    const packageName = manifest.name.replace(/^@exam\//, "");
    byPackage.set(packageName, mappings);
  }
  return { byPackage };
}

function getTable(): WorkspaceResolutionTable {
  cachedTable ??= buildTable();
  return cachedTable;
}

/**
 * Match a package-relative subpath ("" for the root entry) against the
 * package's exports keys. Exact keys win over patterns; among patterns the
 * longest static prefix wins (mirrors the exports algorithm closely enough
 * for the shapes this repository declares — overlapping ambiguous patterns
 * are a manifest smell the architecture check rejects).
 */
function matchMapping(
  mappings: SourceMapping[],
  subpath: string,
): SourceMapping | undefined {
  for (const m of mappings) {
    if (m.prefix === null && m.key === subpath) return m;
  }
  let best: SourceMapping | undefined;
  let bestPrefix = -1;
  for (const m of mappings) {
    if (m.prefix === null) continue;
    if (
      subpath.length >= m.prefix.length + m.suffix!.length &&
      subpath.startsWith(m.prefix) &&
      subpath.endsWith(m.suffix!) &&
      m.prefix.length > bestPrefix
    ) {
      best = m;
      bestPrefix = m.prefix.length;
    }
  }
  return best;
}

export interface WorkspaceSourceResolutionPlugin {
  name: string;
  enforce: "pre";
  resolveId(source: string): string | null;
}

/**
 * Build the plugin. Constructed per vitest config; the underlying table is
 * computed once per process (config files load before workers fork).
 */
export function workspaceSourceResolutionPlugin(): WorkspaceSourceResolutionPlugin {
  return {
    name: "exam-workspace-source-resolution",
    enforce: "pre",
    resolveId(source: string): string | null {
      if (!source.startsWith("@exam/")) return null;
      const table = getTable();
      const withoutScope = source.slice("@exam/".length);
      const slash = withoutScope.indexOf("/");
      const packageName =
        slash === -1 ? withoutScope : withoutScope.slice(0, slash);
      const subpath = slash === -1 ? "" : withoutScope.slice(slash + 1);
      const mappings = table.byPackage.get(packageName);
      if (!mappings) return null;
      const mapping = matchMapping(mappings, subpath);
      if (!mapping) return null;
      const capture =
        mapping.prefix === null
          ? ""
          : subpath.slice(
              mapping.prefix.length,
              subpath.length - mapping.suffix!.length,
            );
      const relativeSource = mapping.sourceTarget
        .replace(/^\.\//, "")
        .replace("*", capture);
      const candidate = join(mapping.packageDir, relativeSource);
      // INVARIANT: fall through (instead of returning a missing file) so a
      // specifier with no real source surfaces the canonical exports error
      // from the default resolution chain, not a plugin-internal ENOENT.
      if (!existsSync(candidate)) return null;
      return candidate;
    },
  };
}
