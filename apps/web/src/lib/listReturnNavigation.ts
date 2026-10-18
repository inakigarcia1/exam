/**
 * The list → detail → back return contract for admin lists (#784 stage A).
 *
 * A list page navigates to a detail/edit/create/import route with
 * `state: listReturnState(location)`; the destination resolves that state back
 * into the list URL it should return to. `history.state` is chosen over a
 * `?from=` query parameter because only same-origin scripts can write it —
 * there is no open-redirect surface to defend, and a user cannot fabricate a
 * return target by editing the address bar.
 *
 * The target still has to be validated: the value round-trips through an
 * attacker-controllable channel (a pasted link cannot carry it, but any
 * same-origin XSS-adjacent write could), and a rejected target must land on the
 * bare list route of the page that owns the exit — never on an arbitrary path.
 */

/** History state a list page attaches when it navigates into a child route. */
export interface ListReturnState {
  /** The list URL (path + query + hash omitted) to return to. */
  from: string;
}

/** Builds the history state carrying the list URL to return to. */
export function listReturnState(location: {
  pathname: string;
  search: string;
}): ListReturnState {
  return { from: `${location.pathname}${location.search}` };
}

/**
 * Resolves the list URL a child page must navigate back to.
 *
 * Returns `${listPath}` (the page's bare list route) whenever the carried
 * target is missing or is not EXACTLY that list route with legal query/hash:
 *
 *   - non-string / absent / empty;
 *   - relative or protocol-relative input ("admin/exams", "//evil.example"),
 *     which either resolves outside the app or to an unrelated path;
 *   - a cross-origin target, including the forms that only diverge AFTER URL
 *     parsing strips tab/CR/LF ("/\t/evil.example", "/\evil.example") — the
 *     origin comparison, not the prefix check, is what rejects those;
 *   - any other route, including one that only reaches it through path
 *     normalization ("/admin/questions/../exams") or percent-encoding
 *     ("/%61dmin/questions");
 *   - malformed input (a trailing slash, a bare "?", a non-string).
 *
 * Legal query parameters and the hash are preserved: the point of the contract
 * is that returning from a detail page restores the exact list query the user
 * left.
 */
export function resolveListReturnPath(
  state: unknown,
  listPath: string,
): string {
  const candidate = (state as { from?: unknown } | null | undefined)?.from;
  if (typeof candidate !== "string") return listPath;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return listPath;
  const resolved = new URL(candidate, window.location.origin);
  if (resolved.origin !== window.location.origin) return listPath;
  if (resolved.pathname !== listPath) return listPath;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
