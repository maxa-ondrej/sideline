import * as path from "node:path"
import { defineWorkspace, type UserWorkspaceConfig } from "vitest/config"

// biome-ignore lint/correctness/noUnusedVariables: template helper for custom project configs
const project = (
  config: UserWorkspaceConfig["test"] & { name: `${string}|${string}` },
  root = config.root ?? path.join(__dirname, `packages/${config.name.split("|").at(0)}`),
) => ({
  extends: "vitest.shared.ts",
  test: { root, ...config },
})

export default defineWorkspace([
  // Add specialized configuration for some packages.
  // project({ name: "my-package|browser", environment: "happy-dom" }),
  // Add the default configuration for all packages.
  "packages/*",
  "applications/*",
])
