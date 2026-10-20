import { describe, expect, it } from "vitest";
import { DEP_SOURCE_MARKER, SOURCE_FIXTURE_MARKER } from "@exam/source-fixture";

/**
 * #794 permanent resolution oracle for THIS Vitest project — both rails.
 *
 * POSITIVE (execution provenance): the fixture packages carry different
 * permanent markers in src/ and built/, so the observed values prove which
 * files the module runner actually executed — the root entry, the
 * transitive workspace edge, and both subpath forms. A regression to
 * dist/default resolution flips every marker to "…:built:*" and fails here.
 *
 * NEGATIVE (fail-closed): the governed @exam/* namespace must never fall
 * through to production dist inside a test run. Each classified rejection
 * of config/workspace-resolution.mjs is pinned: MISSING_SOURCE via the
 * fixture's declared ghost entry (built file exists, source intentionally
 * absent — the permanent "stale dist" injection), NOT_EXPORTED,
 * UNKNOWN_WORKSPACE_PACKAGE and BAD_SPECIFIER_SHAPE via runtime-resolved
 * specifiers. Specifiers are passed through a variable with
 * `@vite-ignore` because a literal failing specifier is rejected during
 * transform — failing the whole file before any assertion could run;
 * the indirection defers resolution to module runtime so the classified
 * rejection itself becomes the assertion target.
 */
const dynamicImport = (specifier: string): Promise<unknown> =>
  import(/* @vite-ignore */ specifier);

describe("workspace source resolution oracle", () => {
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

  it("fails closed when the mapped source is missing (ghost entry)", async () => {
    await expect(dynamicImport("@exam/source-fixture/ghost")).rejects.toThrow(
      /MISSING_SOURCE/,
    );
  });

  it("rejects subpaths the package does not export", async () => {
    await expect(
      dynamicImport("@exam/source-fixture/not-exported"),
    ).rejects.toThrow(/NOT_EXPORTED/);
  });

  it("rejects unknown workspace packages", async () => {
    await expect(
      dynamicImport("@exam/no-such-workspace-package"),
    ).rejects.toThrow(/UNKNOWN_WORKSPACE_PACKAGE/);
  });

  it("rejects extension-suffixed specifiers on pattern entries", async () => {
    await expect(
      dynamicImport("@exam/source-fixture/deep/mod.js"),
    ).rejects.toThrow(/BAD_SPECIFIER_SHAPE/);
  });
});
