# Workspace Module Resolution

**Authority for how `@exam/*` workspace packages resolve in every supported
execution context.** The controlling implementation is
[`config/workspace-resolution.mjs`](../../config/workspace-resolution.mjs)
(single plain-ESM module: table loader, matcher, Vitest plugin — imported by
every Vitest config (the nine projects plus the api test-harness child
configs), `lint:arch` and the production oracle alike, so
there is no second matcher), the package manifests' `exports` fields (the
declared contract), the per-package `tsconfig.build.json` (artifact
lifecycle) and `tsconfig.typecheck.json` (type authority). Enforced
structurally by `pnpm lint:arch` and
`scripts/check-production-resolution.mjs`, and behaviorally by the
permanent positive/negative oracles in every Vitest project. Introduced by
#794 (unification), hardened to fail-closed resolution and governed build
artifacts in the second #794 round.

## The contract

Every workspace package under `packages/` declares its public API in
`package.json` `exports` (all nine manifests — the seven production packages
and the two source-fixture packages — follow this contract). Each entry —
the root `"."` and every supported subpath — is a condition object with
exactly three conditions:

```jsonc
"./repository/*": {
  "@exam/test-source": "./src/repository/*.ts",  // dev/test execution authority
  "types":             "./dist/repository/*.d.ts", // production type authority
  "default":           "./dist/repository/*.js"    // production runtime authority
}
```

| Context | Active conditions | Resolved code |
| --- | --- | --- |
| Production Node (API start, workers, CLI, Playwright) | none of ours | `default` → `dist/` |
| Package builds (`tsc` emit) | `types` | `dist/*.d.ts` for cross-package types; own emit from `tsconfig.build.json` |
| Production web bundle (`apps/web` `vite build`) | none of ours | `default` → `dist/` |
| Vitest (all governed configs — nine projects plus the api child-harness configs; node and jsdom, worker graphs **and** globalSetup) | `@exam/test-source`, activated by the shared plugin | `src/*.ts` |
| Every typecheck entrypoint (`tsconfig.typecheck.json`) | `@exam/test-source` via `customConditions` | `src/*.ts` |

The condition alone is not sufficient: Vitest's worker module graphs honour
`resolve.conditions` / `ssr.resolve.conditions`, but the **main-process
module runner that loads `globalSetup` files ignores both** (empirically
established in #794). A pre-enforce `resolveId` plugin is the one hook that
fires in every Vitest resolution context, so it is the only activation
path. There is deliberately **no** per-package alias, no
`server.deps.inline` workaround, and no duplicated conditions config (the
#689 mechanisms were retired; the first #794 round retired the fall-through
resolveId).

## Test-time resolution fails closed

A specifier in the governed `@exam/*` namespace is **never** allowed to
fall through to the production `default` branch inside a test run. The
plugin resolves through the authority's matcher and throws a classified
error otherwise — the state machine:

| Input | Vitest must |
| --- | --- |
| Governed package + exported key + source exists | execute the source |
| Exported key + source missing (dist exists) | fail: `MISSING_SOURCE` |
| Non-exported subpath | fail: `NOT_EXPORTED` |
| Unknown `@exam/*` package | fail: `UNKNOWN_WORKSPACE_PACKAGE` |
| Pattern match with a capture Node would reject (`.js`, `.test`, `..`/dot segments, `node_modules`, encoded separators, backslash) | fail: `BAD_SPECIFIER_SHAPE` |
| Transitive workspace import | execute the source |
| Third-party dependency | standard supported resolution (unmanaged) |
| Production Node + exported key | execute the built artifact |
| Production Node + private/unknown/suffixed specifier | reject (`ERR_PACKAGE_PATH_NOT_EXPORTED` / `ERR_MODULE_NOT_FOUND`) |

Every classification message names package / specifier / expected source.
Module-load and business errors inside a resolved file are not resolution
matters and propagate untouched.

The matcher mirrors Node's exports semantics for the supported grammar
(exact keys; single-star patterns sorted by longest prefix, then longest
suffix) and refuses to load anything else: multi-star or overlapping
pattern families are rejected at table load (config-load failure for every
Vitest run, violation for `lint:arch`) instead of being silently handed to
a different resolver. A manifest whose declared sources are missing fails
the table load itself; a pattern capture whose specific source file is
missing fails at resolve time with `MISSING_SOURCE`.

**Capture grammar is Node-exact, not permissive.** Native Node rejects
captures containing `.`, `..`, or `node_modules` path segments — raw or
percent-encoded — and any encoded separator or backslash, with
`ERR_INVALID_MODULE_SPECIFIER` before file lookup; the matcher rejects the
same family (`BAD_SPECIFIER_SHAPE`) before any path math. This is not a
style rule: `join()` normalizes paths, so an unvalidated dot-segment
capture could resolve a file the exports field never declared (probed
live: `@exam/db/repository/../sqlIdent` executed the undeclared
`src/sqlIdent.ts` under the plugin while both plain Node and Vitest's
default chain rejected the specifier). Every Vitest project pins the
closed bypass with a permanent oracle probe; the production oracle pins
Node's native rejection with the exact error code.

**Why fail-closed is mandatory**: on the fall-through design, a missing
source silently loaded stale dist behind the test's back (reproduced on an
isolation worktree — a renamed source produced a green test executing
yesterday's artifact). Missing-source is now a loud, classified failure in
every Vitest context, including globalSetup.

## Build artifacts: clean-before-compile

Every compiled package (the seven packages and `apps/api`) builds with
`node ../../scripts/clean-dist.mjs . && tsc -p tsconfig.build.json`, so
dist is always the exact output of the current sources + build config.
`apps/web/dist` is produced by `vite build`, whose default `emptyOutDir`
provides the same clean-before-compile guarantee there:

- `scripts/clean-dist.mjs` removes **only** `<packageDir>/dist` (refusing
  anything outside `packages/*` / `apps/*` build outputs) — the package
  owns its own artifact directory; concurrent turbo tasks never share one.
- `tsconfig.build.json` excludes tests (`*.test.ts`, `*.spec.ts`,
  `__tests__/`, `*.testHelpers.ts`) — compiled test code can no longer
  exist in dist, so no wildcard export can ever expose it. Typechecking
  keeps the full tree (`tsconfig.json`), and dev typechecks add the
  test-source condition (`tsconfig.typecheck.json`).
- Composite packages (domain, authz, contracts) pin their build
  `tsBuildInfoFile` **inside dist** — an incremental-state file outside the
  cleaned directory let `tsc` skip re-emitting after a clean (observed
  live), producing an empty dist that downstream builds then resolved
  against.
- Deleted or renamed sources can therefore no longer leave "orphan"
  artifacts that keep speaking as public API;
  `scripts/check-production-resolution.mjs` asserts orphan-free and
  test-free dist trees as hard failures, not notes.

## Public API surface

- Root entries (`@exam/domain`, `@exam/authz`, `@exam/contracts`,
  `@exam/auth`, `@exam/db`, `@exam/exam-engine`, `@exam/import-export`)
  expose the stable, low-side-effect core API.
- Large packages expose semantic subpath groups instead of a giant barrel.
  `@exam/db` keeps `./repository/*` (the reviewed public repository API)
  and otherwise declares **explicit reviewed entrypoints**
  (`./schema/pg`, `./scripts/destructiveDbNameGuard`,
  `./testHelpers/auditLogTestRepo`, the shared test-infrastructure
  modules, and the seed/demo-seed libraries). A new file becoming
  importable is always a manifest decision, never a side effect of
  existing in dist.
- The seed CLIs live in `apps/api/src` (`db:seed`, `db:seed:demo`, …);
  `@exam/db`'s seed modules are libraries whose hasher enters as a
  parameter — the package holds no production import edge to `@exam/auth`
  (its tests use it through the declared devDependency).
- Physical source paths are **not** public API: `@exam/<pkg>/src/...`
  specifiers are banned in active code (`pnpm lint:arch` rejects them), as
  are cross-package relative imports. Both bypass the declared contract
  and re-introduce dual-resolution.

## Governance layers and their owners

| Layer | Rules | Owner | Dynamic proof |
| --- | --- | --- | --- |
| Package contract validation | exports shape, key grammar, disjoint patterns, source/target existence, negative-entry declarations, banned import forms | `lint:arch` (`scripts/check-architecture.mjs` via the authority loader) | table-load throw at every Vitest config load |
| Test runtime resolution | source-fresh execution, fail-closed classifications in every governed Vitest config (nine projects + api child harnesses) + globalSetup | `config/workspace-resolution.mjs` plugin | positive marker oracles + per-classification rejection oracles + main-process canary (the nine projects carry the dynamic oracles; the child harness configs are enforced statically and run env-guarded fixture proofs only) |
| Production artifact validation | dist-only loading, built-marker polarity (incl. ghost), negative namespace rejection, orphan/test-free dist, entry completeness, compiled-specifier resolvability | `scripts/check-production-resolution.mjs` (wired after `pnpm build` in `pnpm verify` and CI) | child-process provenance hook + plain-Node probes |

Static checks prevent configuration absence; the dynamic oracles prove
actual behavior. Neither substitutes for the other.

## Negative entries are permanent fault injection

`@exam/source-fixture` declares `./ghost` under
`workspaceResolution.negativeEntries`: a exports entry whose source target
(`./src/ghost.ts`) is intentionally absent while its built target
(`./built/ghost.js`) exists. Plain Node loads the ghost (asserted by the
polarity probe); every Vitest project must observe `MISSING_SOURCE` for it
(asserted by the oracles). This makes the dangerous state — *source
missing, dist present* — permanently injected without touching any tracked
file. Only never-built fixture packages may declare negative entries.

## Source-freshness guarantees (and how they are pinned)

- Every Vitest project carries a permanent oracle
  (`src/workspaceSourceResolution.test.ts`) asserting the fixture src
  markers (root, transitive, pattern/exact subpaths) **and** all four
  failure classifications via runtime-resolved specifiers — execution
  provenance and fail-closed behavior, not `import.meta.resolve` probing.
- `apps/api/vitest.globalSetup.ts` throws at load time if the fixture
  resolves to its built marker, pinning the main-process context no other
  oracle reaches.
- Every typecheck entrypoint (`tsconfig.typecheck.json`, api/web/packages)
  activates the same condition the plugin does, so type evidence matches
  the code tests execute — a stale dist `.d.ts` cannot fake a typecheck
  PASS. Production declarations stay the `types`-condition authority for
  consumers outside the workspace, guaranteed fresh by turbo's `^build`
  DAG and the clean-build lifecycle.
- `scripts/check-production-resolution.mjs` is the polarity complement
  (see the table above). If both oracle families ever observed the same
  marker, the fixture polarity itself would be broken.

## Adding a workspace package

1. Create `packages/<name>/` with `src/index.ts`.
2. Declare `exports` with the three-condition shape for the root entry and
   every subpath you intend to publish (see the contract above).
3. Add `tsconfig.build.json` (copy any building package's; excludes tests)
   and build with `clean-dist.mjs` + `tsc -p tsconfig.build.json`.
4. Add `tsconfig.typecheck.json` and point the `typecheck` script at it.
5. Add a `vitest.config.ts` that consumes `workspaceSourceResolutionPlugin()`
   and the `@exam/source-fixture` devDependency (copy any tested package's
   config; keep `envDir: false`).
6. `pnpm lint:arch` enforces all of the above; the resolution plugin
   discovers the package automatically.

## The source-fixture packages are a sanctioned variant

`@exam/source-fixture` / `@exam/source-fixture-dep` never build, so their
`types` condition points at `src` and their `default` at a hand-written
`built/` tree holding the opposite marker — that asymmetry is what makes
the resolution oracles possible, and the ghost entry is what makes the
negative oracles possible. Do not copy them as templates for real packages.

## Special dependencies

Third-party dependencies stay externalized in Vitest (Node loads them; the
plugin only ever rewrites `@exam/*` specifiers), which keeps native modules
(`argon2`) and CJS interop on their production code paths. If a package
ever needs a distinct test-only module, add it as an explicit exports entry
with a declared consumer — never as a second resolution mechanism.
