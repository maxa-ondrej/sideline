import path from "node:path"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tanstackStart(), nitro()],
  resolve: {
    alias: {
      "@sideline/domain": path.resolve(import.meta.dirname, "../../packages/domain/src"),
    },
  },
})
