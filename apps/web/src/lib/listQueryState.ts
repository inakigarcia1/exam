/**
 * Shared URL query-state rules for paginated admin lists.
 *
 * Only rules whose meaning is IDENTICAL on every list live here: what the
 * `page` parameter means, and when an empty page has to be normalized back
 * into range. Each page keeps owning its filter vocabulary, request building
 * and history semantics — a generic list-query hook would have to absorb two
 * pages' business filters to earn its keep (#784 stage-A design, A1.9).
 */

/**
 * Parses the `page` URL parameter.
 *
 * INVARIANT: the returned page is always a positive integer; every input that is
 * not a bare positive decimal (`null`/`undefined`, "0", "-1", "abc", "1.5",
 * " 2", "") means the first page. The value is matched by an explicit pattern
 * instead of `Number()` / `parseInt` so a malformed page can never reach the API
 * as `NaN` — the defect shape that made `/api/questions?page=NaN` a 400 on
 * ScoreListPage.
 *
 * Values beyond `Number.MAX_SAFE_INTEGER` are accepted by the pattern and lose
 * precision in the conversion. They are not special-cased: such a page is
 * out of range by any measure, and the empty page it answers with is normalized
 * back into range by `resolveClampTarget`.
 *
 * Repeated parameters (`?page=3&page=2`): `URLSearchParams.get` returns the
 * FIRST value, and the page rewrites the URL to a single canonical value.
 */
export function parsePageParam(raw: string | null | undefined): number {
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) return 1;
  return Number(raw);
}

/**
 * Decides whether an out-of-range page response must be normalized in one jump
 * instead of being committed (which would render a fake empty state).
 *
 * Returns the page to load next, or null when the response must be committed
 * as-is.
 *
 * INVARIANT (B11, #785): a response with rows is NEVER discarded for being
 * "beyond the last page". The paged SELECT and the COUNT are two statements
 * issued under `Promise.all` (examRepo / questionRepo), so a concurrent delete
 * can legitimately answer `items=[...] && total` that is too small for `page`;
 * clamping on `page > totalPages` alone would throw away real data. Only an
 * EMPTY page above the first one is ever normalized.
 *
 * Termination: the target is `<= page` and strictly smaller whenever it is
 * returned, bounded below by 1 — no redirect/request loop is possible.
 */
export function resolveClampTarget({
  itemCount,
  total,
  page,
  pageSize,
}: {
  /** Number of rows in the response being inspected. */
  itemCount: number;
  /** Server-reported total for the same query. */
  total: number;
  /** Page that produced this response. */
  page: number;
  pageSize: number;
}): number | null {
  if (itemCount > 0 || page <= 1) return null;
  if (total <= 0) return 1;
  const lastValidPage = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return lastValidPage < page ? lastValidPage : null;
}
