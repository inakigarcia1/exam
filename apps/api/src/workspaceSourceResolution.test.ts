import { describe, expect, it } from "vitest";
import { DEP_SOURCE_MARKER, SOURCE_FIXTURE_MARKER } from "@exam/source-fixture";

/**
 * #794 permanent source-freshness oracle for the API project's runtime.
 *
 * The fixture packages carry different permanent markers in src/ and built/,
 * so the observed values prove which files the module runner actually
 * executed: the root entry, the transitive workspace edge, both subpath
 * forms — plus real workspace deep entries (db repository subpath, auth
 * module subpath) whose successful import proves the public subpath exports
 * resolve in this project. A regression to dist/default/externalized
 * resolution flips the fixture markers to "…:built:*" and fails here.
 * Fixtures: packages/source-fixture, packages/source-fixture-dep.
 */
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
});
