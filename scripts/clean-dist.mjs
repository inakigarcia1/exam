// #794 (round 2, R2) — package dist lifecycle: clean-before-compile.
//
// tsc never deletes outputs that its inputs stopped producing, so deleted or
// renamed sources used to leave stale dist artifacts behind — publicly
// reachable through wildcard exports and loadable by plain Node (the
// "orphan dist" failure family). Every buildable package now runs this
// script as the first step of its build, so a package's dist is ALWAYS the
// exact output of its current sources + build config:
//
//   "build": "node ../../scripts/clean-dist.mjs . && tsc -p tsconfig.build.json"
//
// Safety contract: the only argument is the PACKAGE directory ("."), and
// the only path this script will ever remove is <packageDir>/dist. It
// refuses anything else — no globs, no recursion across packages, no
// user-file reach.
import { existsSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = resolve(process.argv[2] ?? ".");
const distDir = resolve(packageDir, "dist");

if (
  !distDir.startsWith(resolve(REPO_ROOT, "packages") + "/") &&
  !distDir.startsWith(resolve(REPO_ROOT, "apps") + "/")
) {
  process.stderr.write(
    `clean-dist: refusing ${distDir} — only packages/* and apps/* build outputs are owned here\n`,
  );
  process.exit(1);
}
if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) {
  process.stderr.write(`clean-dist: ${packageDir} is not a directory\n`);
  process.exit(1);
}
rmSync(distDir, { recursive: true, force: true });
process.stdout.write(`clean-dist: removed ${distDir}\n`);
