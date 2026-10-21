// Type declarations for config/workspace-resolution.mjs — the single
// resolution authority (plain ESM so the plain-Node check scripts import the
// same implementation the Vitest plugin runs).
export declare const TEST_SOURCE_CONDITION = "@exam/test-source";
export declare const RESOLUTION_FAILURE_CLASSIFICATIONS: readonly [
  "UNKNOWN_WORKSPACE_PACKAGE",
  "NOT_EXPORTED",
  "BAD_SPECIFIER_SHAPE",
  "MISSING_SOURCE",
];
export interface WorkspaceResolutionEntry {
  readonly key: string;
  readonly prefix: string | null;
  readonly suffix: string | null;
  readonly sourceTarget: string;
  readonly typesTarget: string;
  readonly defaultTarget: string;
  readonly negative: boolean;
}
export interface WorkspaceResolutionPackage {
  readonly packageDir: string;
  readonly exact: ReadonlyMap<string, WorkspaceResolutionEntry>;
  readonly patterns: readonly WorkspaceResolutionEntry[];
}
export interface WorkspaceResolutionTable {
  readonly packages: ReadonlyMap<string, WorkspaceResolutionPackage>;
}
export declare function loadWorkspaceResolutionTable(
  packagesDir?: string,
): WorkspaceResolutionTable;
export declare function getWorkspaceResolutionTable(): WorkspaceResolutionTable;
export type WorkspaceSourceMatch =
  | { status: "unmanaged" }
  | { status: "resolved"; file: string }
  | {
      status: "error";
      classification:
        | "UNKNOWN_WORKSPACE_PACKAGE"
        | "NOT_EXPORTED"
        | "BAD_SPECIFIER_SHAPE"
        | "MISSING_SOURCE";
      message: string;
    };
export declare function matchWorkspaceSource(
  table: WorkspaceResolutionTable,
  specifier: string,
): WorkspaceSourceMatch;
export interface WorkspaceSourceResolutionPlugin {
  readonly name: string;
  readonly enforce: "pre";
  resolveId(source: string): string | null;
}
export declare function workspaceSourceResolutionPlugin(): WorkspaceSourceResolutionPlugin;
export type ProductionArtifactMatch =
  | { status: "unmanaged" }
  | {
      status: "resolved";
      pkg: string;
      packageDir: string;
      entry: WorkspaceResolutionEntry;
      capture: string;
      target: string;
    }
  | {
      status: "error";
      classification:
        | "UNKNOWN_WORKSPACE_PACKAGE"
        | "NOT_EXPORTED"
        | "BAD_SPECIFIER_SHAPE";
      message: string;
    };
export declare function resolveProductionArtifact(
  table: WorkspaceResolutionTable,
  specifier: string,
): ProductionArtifactMatch;
/**
 * The single compiled-test-artifact grammar shared by both dist auditors
 * (check-production-resolution.mjs, check-deploy-payload.mjs); must be
 * applied to the path relative to the audited dist root.
 */
export declare const TEST_ARTIFACT_PATTERN: RegExp;
