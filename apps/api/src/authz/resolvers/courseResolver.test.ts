import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repos so the resolver logic (org-anchor, not-found, broken chain)
// is tested without DB fixtures (same pattern as attemptResolver.test.ts).
let courseChain: Record<string, unknown> | null = null;

vi.mock("@exam/db/repository/courseRepo", () => ({
  createCourseRepo: () => ({
    findAuthorizationChain: async (_ctx: unknown, id: string) =>
      courseChain && courseChain.courseId === id ? courseChain : null,
  }),
}));

const { createCourseResolver } = await import("./courseResolver.js");

const ORG = randomUUID();
const ACTOR = randomUUID();

describe("course scope resolver (issue #286)", () => {
  beforeEach(() => {
    courseChain = null;
  });

  it("resolves a same-org course to Scope.Course", async () => {
    const id = randomUUID();
    courseChain = {
      courseId: id,
      courseOrganizationId: ORG,
      organizationId: ORG,
    };
    const r = await createCourseResolver({} as never).resolve(
      { actorId: ACTOR, organizationId: ORG },
      { type: "course", id },
    );
    expect(r).toMatchObject({
      scope: "course",
      organizationId: ORG,
      resourceId: id,
      chain: [{ type: "course", id }],
    });
  });

  it("denies organization_mismatch for a course in another org", async () => {
    const id = randomUUID();
    courseChain = {
      courseId: id,
      courseOrganizationId: randomUUID(),
      organizationId: randomUUID(),
    };
    const logger = { warn: vi.fn(), error: vi.fn() };
    const r = await createCourseResolver({} as never, logger as never).resolve(
      { actorId: ACTOR, organizationId: ORG },
      { type: "course", id },
    );
    expect(r).toMatchObject({ denied: true, reason: "organization_mismatch" });
  });
});
