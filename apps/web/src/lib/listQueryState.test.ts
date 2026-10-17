import { describe, expect, it } from "vitest";
import { parsePageParam, resolveClampTarget } from "./listQueryState";

/**
 * A17 / A10 — the two page-agnostic URL rules. The independent expectation in
 * every case is the contract table of the #784 stage-A design (A1.2 `page`
 * row, A1.4 clamp rules), not the implementation.
 */
describe("parsePageParam", () => {
  it("accepts a positive integer page", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("2")).toBe(2);
    expect(parsePageParam("41")).toBe(41);
  });

  it.each([
    ["absent", null],
    ["undefined", undefined],
    ["empty", ""],
    ["zero", "0"],
    ["negative", "-1"],
    ["non-numeric", "abc"],
    ["fractional", "1.5"],
    ["exponent", "1e3"],
    ["hex", "0x2"],
    ["leading zero", "03"],
    ["whitespace padded", " 2"],
    ["whitespace", " "],
    ["sign", "+2"],
    ["infinity", "Infinity"],
    ["NaN", "NaN"],
  ])("falls back to page 1 for %s", (_label, raw) => {
    expect(parsePageParam(raw)).toBe(1);
  });

  it("never returns NaN, so a malformed page cannot reach the API", () => {
    for (const raw of ["abc", "1.5", "0", ""]) {
      expect(Number.isInteger(parsePageParam(raw))).toBe(true);
    }
  });
});

describe("resolveClampTarget", () => {
  const base = { itemCount: 0, total: 0, page: 1, pageSize: 20 };

  it("never discards a non-empty page, even when total is too small for it", () => {
    // Concurrent delete between the paged SELECT and the COUNT: rows exist,
    // total says otherwise. The response must be committed as-is.
    expect(
      resolveClampTarget({
        ...base,
        itemCount: 3,
        total: 20,
        page: 4,
      }),
    ).toBeNull();
    expect(
      resolveClampTarget({
        ...base,
        itemCount: 1,
        total: 0,
        page: 9,
      }),
    ).toBeNull();
  });

  it("commits an empty first page untouched", () => {
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 0, page: 1 }),
    ).toBeNull();
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 41, page: 1 }),
    ).toBeNull();
  });

  it("normalizes an empty page to page 1 when nothing matches", () => {
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 0, page: 3 }),
    ).toBe(1);
  });

  it("jumps straight to the last valid page of an emptied page", () => {
    // 41 records / 20 per page = 3 pages; page 4 is out of range.
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 41, page: 4 }),
    ).toBe(3);
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 20, page: 2 }),
    ).toBe(1);
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 21, page: 3 }),
    ).toBe(2);
  });

  it("keeps a still-valid empty page (COUNT/SELECT different snapshots)", () => {
    // total 41 ⇒ last valid page 3; the response for page 2 is empty but in
    // range, so it is a real (empty) result, not a recovery case.
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 41, page: 2 }),
    ).toBeNull();
    expect(
      resolveClampTarget({ ...base, itemCount: 0, total: 41, page: 3 }),
    ).toBeNull();
  });

  it("treats a non-positive page size as a single row per page", () => {
    // 5 records at one row per page ⇒ the last valid page is 5, not Infinity
    // (a 0 divisor would make every page look in range and skip recovery).
    expect(
      resolveClampTarget({
        ...base,
        itemCount: 0,
        total: 5,
        page: 9,
        pageSize: 0,
      }),
    ).toBe(5);
  });

  it("terminates: each target is smaller than the page that produced it", () => {
    let page = 7;
    const visited: number[] = [];
    for (let guard = 0; guard < 10; guard += 1) {
      const next = resolveClampTarget({
        ...base,
        itemCount: 0,
        total: 41,
        page,
        pageSize: 20,
      });
      visited.push(next ?? page);
      if (next === null) break;
      expect(next).toBeLessThan(page);
      page = next;
    }
    expect(visited).toEqual([3, 3]);
  });
});
