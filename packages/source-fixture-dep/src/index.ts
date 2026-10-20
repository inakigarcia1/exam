/**
 * #794 source-freshness fixture (transitive dependency half).
 *
 * src/ and built/ carry DIFFERENT permanent markers: anything that resolves
 * this package's default condition (Node production, an externalized or
 * unaliased Vitest import) observes "…:built:root", while the workspace
 * source-resolution mechanism observes "…:src:root". Never built; never
 * imported by production code.
 */
export const DEP_SOURCE_MARKER = "source-fixture-dep:src:root";
