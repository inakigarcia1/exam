# Deploy Payload Artifact Contract

**Authority for what the production API runtime image is allowed to carry.**
The controlling implementation is
[`scripts/check-deploy-payload.mjs`](../../scripts/check-deploy-payload.mjs)
(`pnpm lint:deploy-payload <payload-dir>`), which asserts the contract
against a real deploy output or an extracted image `/app` tree — never
against `package.json` declarations alone. Introduced by #798.

## The three boundaries

Three different mechanisms decide which files exist where, and they must not
be conflated:

| Boundary | Mechanism | Controls |
| --- | --- | --- |
| Docker build context | `.dockerignore` | which host files reach the builder at all |
| Deploy payload | `files` allowlists in workspace manifests + `pnpm --filter @exam/api --prod deploy --legacy /out` | what the deployed application directory and its workspace dependencies contain |
| Runtime image | Dockerfile `runner` / `web-runner` stages | what `/app` (and the nginx edge) finally hold |

`.dockerignore` excluding a file does not imply the deploy payload excludes
it; `--prod` prunes devDependencies but does not prune sources. Each layer
is audited on its own artifacts.

## The contract

Every deployed file is either a **built artifact**, a **declared runtime
asset**, or **packlist metadata**:

- `apps/api` declares `files: ["dist"]` — the compiled application
  (`dist/server.js`, `dist/scripts/migrate.js`, `dist/workers/*.js`) is the
  entire payload. `openapi.json` is a build/dev artifact (the runtime
  generates the spec in memory), `public/` is the E2E-staged SPA (the API
  image must never carry an SPA origin, #585), and sources/tests/tool
  configs never execute in production.
- The six pure-code packages (`auth`, `authz`, `contracts`, `domain`,
  `exam-engine`, `import-export`) declare `files: ["dist"]`.
- `@exam/db` declares `files: ["dist", "migrations/postgres"]` — the
  migrator resolves `../migrations/postgres` relative to `dist/postgres.js`
  (`packages/db/src/postgres.ts`), so the SQL files and Drizzle's
  `meta/_journal.json` are runtime assets, not build inputs. The payload
  journal must equal the repository journal (same tags, same order).
- `package.json` (and README/LICENSE where present) is retained by the
  npm/pnpm packlist by design; this is metadata, not a policy failure.
- The image-owned `/app/data` mountpoint is created by the Dockerfile
  runner stage and is not a deploy artifact.

`files` is the **deployment file contract**; the `exports` map is the
**resolution contract** (`@exam/test-source` → src, `types`/`default` →
dist, see [workspace-module-resolution.md](workspace-module-resolution.md)).
Development repositories keep their sources; production payloads carry only
approved runtime files. Neither field may be used to bypass the other.

## Enforcement

- **CI**: the `production-transport-regression` job extracts `/app` from the
  freshly built API image (`docker cp`) and runs the oracle before any
  container boots, then probes production module resolution and the argon2
  native binding inside the image (`import.meta.resolve` polarity +
  load through `@exam/auth/password`, the owning import path — pnpm's
  strict layout hides transitive deps from the app root by design).
- **Locally**: run a deploy and point the oracle at it:
  `pnpm --filter @exam/api --prod deploy --legacy /tmp/out &&
  pnpm lint:deploy-payload /tmp/out`.
- The oracle reuses `config/workspace-resolution.mjs` — the same matcher as
  the Vitest plugin and `scripts/check-production-resolution.mjs` — so the
  specifier→artifact mapping has one authority. It additionally asserts
  negative closure: no sources, tests, coverage, tool configs, `.env*`
  files, or dev toolchain packages anywhere in the payload.

Inside `dist` the only content rule is the shared "no compiled test
artifacts" pattern; declared entrypoints that merely resemble test support
(e.g. `@exam/db`'s exported `dist/testHelpers`) and the #794-pinned
incremental state file (`dist/tsconfig.build.tsbuildinfo`) are legitimate
dist content.
