// Deliberately built-only module (no src twin): the "./ghost" exports entry
// of this package is a DECLARED NEGATIVE entry
// (workspaceResolution.negativeEntries in package.json). Plain Node resolves
// it to this built file — production stays loadable — while the Vitest
// plugin must fail the specifier closed with MISSING_SOURCE because the
// test-source target ./src/ghost.ts intentionally does not exist. This
// asymmetry IS the permanent fault injection behind the negative resolution
// oracles: "source missing, dist present" without touching any tracked file.
export const SOURCE_FIXTURE_GHOST_MARKER = "source-fixture:built:ghost";
