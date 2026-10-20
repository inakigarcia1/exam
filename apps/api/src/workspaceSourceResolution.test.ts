import { describe, expect, it } from "vitest";
import { DEP_SOURCE_MARKER, SOURCE_FIXTURE_MARKER } from "@exam/source-fixture";

/**
 * #794 permanent resolution oracle for the API project's runtime — both
 * rails.
 *
 * POSITIVE (execution provenance): the fixture packages carry different
 * permanent markers in src/ and built/, so the observed values prove which
 * files the module runner actually executed — the root entry, the
 * transitive workspace edge, both subpath forms — plus real workspace deep
 * entries (db repository subpath, auth module subpath) whose successful
 * import proves the public subpath exports resolve in this project. A
 * regression to dist/default resolution flips the fixture markers to
 * "…:built:*" and fails here.
 *
 * NEGATIVE (fail-closed): the governed @exam/* namespace must never fall
 * through to production dist inside a test run. Each classified rejection
 * of config/workspace-resolution.mjs is pinned — MISSING_SOURCE (fixture
 * ghost entry), NOT_EXPORTED, UNKNOWN_WORKSPACE_PACKAGE,
 * BAD_SPECIFIER_SHAPE — including against real packages (@exam/db), whose
 * compiled dist exists locally and would otherwise be the silent fallback
 * target. Specifiers pass through a variable with `@vite-ignore` because a
 * literal failing specifier is rejected during transform, failing the whole
 * file before any assertion could run; the indirection defers resolution to
 * module runtime so the classified rejection itself becomes the assertion
 * target.
 */
const dynamicImport = (specifier: string): Promise<unknown> =>
  import(/* @vite-ignore */ specifier);

describe("workspace source resolution oracle (api)", () => {
  it("executes the fixture's source, not its built artifact", () => {
    expect(SOURCE_FIXTURE_MARKER).toBe("source-fixture:src:root");
  });

  it("executes sources for the transitive workspace dependency", () => {
    expect(DEP_SOURCE_MARKER).toBe("source-fixture-dep:src:root");
  });

  it("executes sources for pattern and exact subpath entries", async () => {
    const { DEEP_MOD_MARKER } = await import("@exam/source-fixture/deep/mod");
    const { WIDGET_MARKER } =
      await import("@exam/source-fixture/repository/widget");
    expect(DEEP_MOD_MARKER).toBe("source-fixture:src:deep/mod");
    expect(WIDGET_MARKER).toBe("source-fixture:src:repository/widget");
  });

  it("resolves real workspace deep entries to live modules", async () => {
    const examRepo = await import("@exam/db/repository/examRepo");
    expect(typeof examRepo).toBe("object");
    const password = await import("@exam/auth/password");
    expect(typeof password).toBe("object");
  });

  it("fails closed when the mapped source is missing (ghost entry)", async () => {
    await expect(dynamicImport("@exam/source-fixture/ghost")).rejects.toThrow(
      /MISSING_SOURCE/,
    );
  });

  it("rejects subpaths the package does not export", async () => {
    await expect(
      dynamicImport("@exam/source-fixture/not-exported"),
    ).rejects.toThrow(/NOT_EXPORTED/);
    await expect(dynamicImport("@exam/db/not-exported")).rejects.toThrow(
      /NOT_EXPORTED/,
    );
  });

  it("rejects unknown workspace packages", async () => {
    await expect(
      dynamicImport("@exam/no-such-workspace-package"),
    ).rejects.toThrow(/UNKNOWN_WORKSPACE_PACKAGE/);
  });

  it("rejects extension-suffixed and test-marked specifiers", async () => {
    await expect(
      dynamicImport("@exam/source-fixture/deep/mod.js"),
    ).rejects.toThrow(/BAD_SPECIFIER_SHAPE/);
    await expect(
      dynamicImport("@exam/db/repository/examRepo.test"),
    ).rejects.toThrow(/BAD_SPECIFIER_SHAPE/);
  });

  it("rejects dot-segment captures pointing at undeclared modules", async () => {
    // Grammar parity with Node's exports resolution (probed live, #794):
    // native Node rejects this specifier with ERR_INVALID_MODULE_SPECIFIER
    // before any file lookup. The probed pre-fix behavior here was worse
    // than a mere parity gap — join() normalized the capture and the
    // plugin EXECUTED the undeclared src/sqlIdent.ts (no exports key
    // declares "./sqlIdent"). This probe pins the closed bypass.
    await expect(
      dynamicImport("@exam/db/repository/../sqlIdent"),
    ).rejects.toThrow(/BAD_SPECIFIER_SHAPE/);
  });
});
