import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { DatabaseLive } from "./index.js"

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Migrations completed successfully")
})

program.pipe(Effect.provide(DatabaseLive), NodeRuntime.runMain)
