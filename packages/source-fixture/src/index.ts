/**
 * #794 source-freshness fixture (root entry).
 *
 * src/ and built/ carry DIFFERENT permanent markers, so a test importing the
 * root entry proves from the marker which file the module runner actually
 * executed. Re-exports the dep fixture so the TRANSITIVE edge (this module
 * importing another workspace package) is proven by the same assertion:
 * a stale/externalized transitive import yields "…:built:root".
 */
export { DEP_SOURCE_MARKER } from "@exam/source-fixture-dep";
export const SOURCE_FIXTURE_MARKER = "source-fixture:src:root";
