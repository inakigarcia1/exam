/**
 * #794 source-freshness fixture — the STALE artifact half. Deliberately not
 * equal to src/index.ts so consumers prove which file they executed.
 */
export const DEP_SOURCE_MARKER = "source-fixture-dep:built:root";
