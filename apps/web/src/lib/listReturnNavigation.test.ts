import { describe, expect, it } from "vitest";
import { listReturnState, resolveListReturnPath } from "./listReturnNavigation";

/**
 * A05 / C2 — the return-target writer and the resolver's negative boundary.
 * The independent expectation is the ratified C2 rule: a child page may only
 * ever return to ITS OWN list route, with legal query/hash; everything else
 * falls back to that route.
 */
const QUESTIONS = "/admin/questions";
const EXAMS = "/admin/exams";

describe("listReturnState", () => {
  it("carries the list path and its query string", () => {
    expect(
      listReturnState({ pathname: QUESTIONS, search: "?courseId=c1&page=3" }),
    ).toEqual({ from: `${QUESTIONS}?courseId=c1&page=3` });
  });

  it("carries a bare list path when no query is active", () => {
    expect(listReturnState({ pathname: EXAMS, search: "" })).toEqual({
      from: EXAMS,
    });
  });
});

describe("resolveListReturnPath", () => {
  it("returns the carried list URL with its query and hash", () => {
    expect(
      resolveListReturnPath(
        { from: `${QUESTIONS}?courseId=c1&tags=%E4%BB%A3%E6%95%B0&page=3` },
        QUESTIONS,
      ),
    ).toBe(`${QUESTIONS}?courseId=c1&tags=%E4%BB%A3%E6%95%B0&page=3`);
    expect(resolveListReturnPath({ from: `${EXAMS}#results` }, EXAMS)).toBe(
      `${EXAMS}#results`,
    );
    expect(resolveListReturnPath({ from: EXAMS }, EXAMS)).toBe(EXAMS);
  });

  it("falls back when the state is missing or not a string path", () => {
    expect(resolveListReturnPath(undefined, QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath(null, QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath({}, QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath({ from: undefined }, QUESTIONS)).toBe(
      QUESTIONS,
    );
    expect(resolveListReturnPath({ from: 42 }, QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath({ from: null }, QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath("string-state", QUESTIONS)).toBe(QUESTIONS);
    expect(resolveListReturnPath({ from: {} }, QUESTIONS)).toBe(QUESTIONS);
  });

  it("falls back for empty, relative and query-only targets", () => {
    // These are same-origin, so an origin-only check would let them through and
    // send the user to the app root or a wrong relative path.
    for (const from of ["", "#x", "?page=2", "admin/questions", "./admin"]) {
      expect(resolveListReturnPath({ from }, QUESTIONS)).toBe(QUESTIONS);
    }
  });

  it("falls back for protocol-relative, absolute and other-scheme targets", () => {
    // Every entry names the LAYER that rejects it, so an implementation that
    // drops that layer fails here:
    //  - shape: anything not starting with a single "/" would send the user to
    //    the app root or off-origin entirely
    //  - origin: WHATWG parsing strips tab/CR/LF BEFORE parsing, so
    //    "/\t/evil.example" is only caught by comparing origins; a backslash is
    //    a path separator, which makes "/\evil.example" protocol-relative.
    for (const from of [
      "//evil.example/admin/questions", // shape: protocol-relative
      "///evil.example", // shape: protocol-relative
      "https://evil.example/admin/questions", // shape: absolute URL
      "https:evil.example", // shape: scheme with no path
      "/\\evil.example", // origin: backslash separator
      "/\t/evil.example", // origin: tab stripped before parsing
      "/\n/evil.example", // origin: LF stripped before parsing
      "/\r/evil.example", // origin: CR stripped before parsing
    ]) {
      expect(resolveListReturnPath({ from }, QUESTIONS)).toBe(QUESTIONS);
    }
  });

  it("a same-origin absolute target is a documented non-discriminating case", () => {
    // Kept as an explicit statement of a limit rather than as evidence: a
    // correct resolver and one that accepts ANY same-origin URL both return
    // "/admin/questions" for this input, so the row cannot tell them apart. The
    // inputs that can are in the tests above and below.
    expect(
      resolveListReturnPath(
        { from: "http://localhost:3000/admin/questions" },
        QUESTIONS,
      ),
    ).toBe(QUESTIONS);
  });

  it("falls back for any route other than this page's own list", () => {
    for (const from of [
      EXAMS,
      `${EXAMS}?status=published`,
      "/admin/users",
      "/admin",
      "/",
      "/login",
      "/exam/list",
    ]) {
      expect(resolveListReturnPath({ from }, QUESTIONS)).toBe(QUESTIONS);
    }
    // ...and symmetrically for the exam exits.
    expect(resolveListReturnPath({ from: QUESTIONS }, EXAMS)).toBe(EXAMS);
  });

  it("falls back when only path normalization or encoding reaches the list route", () => {
    // The pathname after WHATWG normalization is /admin/exams — not the list
    // this exit belongs to — so the target is rejected.
    expect(
      resolveListReturnPath({ from: `${QUESTIONS}/../exams` }, QUESTIONS),
    ).toBe(QUESTIONS);
    expect(resolveListReturnPath({ from: `${QUESTIONS}/` }, QUESTIONS)).toBe(
      QUESTIONS,
    );
    expect(resolveListReturnPath({ from: `${QUESTIONS}/./x` }, QUESTIONS)).toBe(
      QUESTIONS,
    );
    expect(
      resolveListReturnPath({ from: "/%61dmin/questions" }, QUESTIONS),
    ).toBe(QUESTIONS);
    expect(resolveListReturnPath({ from: `${QUESTIONS}//x` }, QUESTIONS)).toBe(
      QUESTIONS,
    );
  });

  it("never returns a target outside the allowed list route", () => {
    const hostile = [
      "//evil.example/admin/questions",
      "/\\evil.example",
      "/\t/evil.example",
      "https://evil.example/admin/questions",
      `${QUESTIONS}/../exams`,
      `${QUESTIONS}/`,
      "/%61dmin/questions",
      "#x",
      "",
    ];
    for (const from of hostile) {
      const resolved = resolveListReturnPath({ from }, QUESTIONS);
      expect(resolved.startsWith(QUESTIONS)).toBe(true);
    }
  });
});
