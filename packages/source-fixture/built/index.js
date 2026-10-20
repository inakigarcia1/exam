/**
 * #794 source-freshness fixture — the STALE artifact half. Deliberately not
 * equal to src/index.ts so consumers prove which file they executed.
 */
export { DEP_SOURCE_MARKER } from "@exam/source-fixture-dep";
export const SOURCE_FIXTURE_MARKER = "source-fixture:built:root";
