import * as path from "node:path"
import { defineConfig } from "vitest/config"

const alias = (name: string, location = "packages") => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src"
  return {
    [`${name}/test`]: path.join(__dirname, location, name, "test"),
    [`${name}`]: path.join(__dirname, location, name, target),
  }
}

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "applications/*/vitest.config.ts",
      {
        extends: true,
        esbuild: {
          target: "es2020",
        },
        optimizeDeps: {
          exclude: ["bun:sqlite"],
        },
        test: {
          setupFiles: [path.join(__dirname, "setupTests.ts")],
          fakeTimers: {
            toFake: undefined,
          },
          sequence: {
            concurrent: true,
          },
          include: ["test/**/*.test.ts"],
          alias: {
            ...alias("bot", "applications"),
            ...alias("domain"),
            ...alias("migrations"),
            ...alias("server", "applications"),
          },
        },
      },
    ],
  },
})
