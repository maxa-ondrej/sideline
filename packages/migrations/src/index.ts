import { fileURLToPath } from "node:url"
import { NodeFileSystem } from "@effect/platform-node"
import { Migrator } from "@effect/sql"
import { fromFileSystem } from "@effect/sql/Migrator/FileSystem"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer } from "effect"

const migrationsDir = fileURLToPath(new URL("migrations", import.meta.url))

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
})

const migrator = Migrator.make({})

const DatabaseLive = migrator({
  loader: fromFileSystem(migrationsDir),
}).pipe(Layer.effectDiscard, Layer.provideMerge(PgLive), Layer.provide(NodeFileSystem.layer))

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Migrations completed successfully")
})

export const migrate = Effect.provide(program, DatabaseLive)
