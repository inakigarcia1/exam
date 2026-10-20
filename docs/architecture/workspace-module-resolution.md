# Workspace Module Resolution

**Authority for how `@exam/*` workspace packages resolve in every supported
execution context.** The controlling implementation is
[`config/workspace-resolution.ts`](../../config/workspace-resolution.ts) (test
activation) and the seven package manifests' `exports` fields (the declared
contract). Enforced structurally by `pnpm lint:arch` and
`scripts/check-production-resolution.mjs`. Introduced by #794, replacing the
retired #689 single-package alias mechanism.

## The contract

Every workspace package under `packages/` declares its public API in
`package.json` `exports`. Each entry — the root `"."` and every supported
subpath — is a condition object with exactly three conditions:

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
| Package builds (`tsc` emit) and editors | `types` | `dist/*.d.ts` |
| Production web bundle (`apps/web` `vite build`) | none of ours | `default` → `dist/` |
| Vitest (all nine projects, node and jsdom, worker graphs **and** globalSetup) | `@exam/test-source`, activated by the shared plugin | `src/*.ts` |
| `apps/api` direct typecheck (`tsconfig.typecheck.json`) | `@exam/test-source` via `customConditions` | `src/*.ts` |

## Why both a condition and a plugin

The condition alone is not sufficient: Vitest's worker module graphs honour
`resolve.conditions` / `ssr.resolve.conditions`, but the **main-process module
runner that loads `globalSetup` files resolves with Vite's default condition
set and ignores both** (empirically established in #794). A pre-enforce
`resolveId` plugin is the one hook that fires in every Vitest resolution
context. `config/workspace-resolution.ts` therefore:

1. declares the reserved condition name (`TEST_SOURCE_CONDITION`);
2. auto-discovers every `packages/*/package.json` and derives the
   specifier→source mapping from the same `exports` manifests — there is no
   second mapping table;
3. exposes `workspaceSourceResolutionPlugin()`, consumed by all nine Vitest
   configs.

There is deliberately **no** per-package alias, no `server.deps.inline`
workaround, and no duplicated conditions config (the #689 mechanisms —
`config/vitest.sourceAliases.ts`, the `@exam/contracts` inline, and the api
typecheck `paths` entry — were retired by #794).

## Public API surface

- Root entries (`@exam/domain`, `@exam/authz`, `@exam/contracts`, `@exam/auth`,
  `@exam/db`, `@exam/exam-engine`, `@exam/import-export`) expose the stable,
  low-side-effect core API.
- Large packages expose semantic subpath groups instead of a giant barrel:
  `@exam/db/repository/*`, `@exam/db/schema`, `@exam/db/schema/*`,
  `@exam/db/scripts/*`, `@exam/db/testHelpers/*`, and explicit entries for the
  shared db infrastructure modules (`@exam/db/testDb`, `@exam/db/testIsolation`,
  …); `@exam/auth/password|session|tokens`.
- Physical source paths are **not** public API: `@exam/<pkg>/src/...`
  specifiers are banned in active code (`pnpm lint:arch` rejects them), as are
  cross-package relative imports. Both bypass the declared contract and
  re-introduce dual-resolution.

## Source-freshness guarantees (and how they are pinned)

- Every Vitest project carries a permanent oracle
  (`src/workspaceSourceResolution.test.ts`) against the
  `@exam/source-fixture` / `@exam/source-fixture-dep` packages, whose `src/`
  and `built/` trees hold different permanent markers. The oracles assert the
  src markers for the root entry, both subpath forms, and the transitive
  workspace edge — execution provenance, not `import.meta.resolve` probing.
- `apps/api/vitest.globalSetup.ts` throws at load time if the fixture resolves
  to its built marker, pinning the main-process context that no other oracle
  reaches.
- `scripts/check-production-resolution.mjs` (wired into `pnpm verify` after
  `pnpm build`) is the polarity complement: plain Node must load `dist/`
  (`built/` for the fixtures) for every declared entry, and every `@exam/*`
  specifier compiled into `apps/api/dist` must resolve under the production
  branch. If both oracle families ever observed the same marker, the fixture
  polarity itself would be broken.

## Adding a workspace package

1. Create `packages/<name>/` with `src/index.ts`.
2. Declare `exports` with the three-condition shape for the root entry and
   every subpath you intend to publish (see the contract above).
3. Add a `vitest.config.ts` that consumes `workspaceSourceResolutionPlugin()`
   (copy any tested package's config; keep `envDir: false`).
4. `pnpm lint:arch` enforces all of the above — a missing manifest entry,
   missing vitest project, or physical `/src/` specifier fails the gate.
5. Nothing else: the resolution plugin discovers the package automatically.

## Special dependencies

Third-party dependencies stay externalized in Vitest (Node loads them; the
plugin only ever rewrites `@exam/*` specifiers), which keeps native modules
(`argon2`) and CJS interop on their production code paths. If a package ever
needs a distinct test-only module, add it as an explicit exports entry — never
as a second resolution mechanism.
