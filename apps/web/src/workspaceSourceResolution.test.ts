import { describe, expect, it } from "vitest";
import { DEP_SOURCE_MARKER, SOURCE_FIXTURE_MARKER } from "@exam/source-fixture";

/**
 * #794 permanent source-freshness oracle for the jsdom (web) project.
 *
 * The fixture packages carry different permanent markers in src/ and built/,
 * so the observed values prove which files the jsdom module graph actually
 * executed — including the transitive edge. Before #794 this project had NO
 * workspace source handling at all: every @exam/* import silently executed
 * stale dist in a direct vitest run. A regression flips the markers to
 * "…:built:*" and fails here. Fixtures: packages/source-fixture{,-dep}.
 */
describe("workspace source resolution oracle (web/jsdom)", () => {
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
