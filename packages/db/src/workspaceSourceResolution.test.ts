import { describe, expect, it } from "vitest";
import { DEP_SOURCE_MARKER, SOURCE_FIXTURE_MARKER } from "@exam/source-fixture";

/**
 * #794 permanent source-freshness oracle for THIS Vitest project.
 *
 * The fixture packages carry different permanent markers in src/ and built/,
 * so the observed values prove which files the module runner actually
 * executed: the root entry, the transitive workspace edge (fixture ->
 * fixture-dep, imported from inside a processed module), and both subpath
 * forms. A regression to dist/default/externalized resolution flips every
 * marker to "…:built:*" and fails here — no import.meta.resolve probing.
 * Fixtures: packages/source-fixture, packages/source-fixture-dep.
 */
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
});
