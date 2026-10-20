import { defineConfig } from "vitest/config";
import { workspaceSourceResolutionPlugin } from "../../config/workspace-resolution.mjs";

export default defineConfig({
  // #741: per-package implicit envDir admission is OFF (pinned by
  // scripts/check-env-surface.mjs).
  envDir: false,
  // #794: workspace packages resolve to sources in tests (transitively
  // included) — see config/workspace-resolution.mjs.
  plugins: [workspaceSourceResolutionPlugin()],
  test: {
    environment: "node",
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
      },
    },
  },
});
