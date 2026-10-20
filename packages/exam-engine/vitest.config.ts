import { defineConfig } from "vitest/config";
import { workspaceSourceResolutionPlugin } from "../../config/workspace-resolution.js";

export default defineConfig({
  // #741: per-package implicit envDir admission is OFF (pinned by
  // scripts/check-env-surface.mjs).
  envDir: false,
  // #794: workspace packages resolve to sources in tests (transitively
  // included) — see config/workspace-resolution.ts.
  plugins: [workspaceSourceResolutionPlugin()],
  test: {
    exclude: ["dist/**", "node_modules/**"],
  },
});
