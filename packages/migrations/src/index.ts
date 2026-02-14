import { fileURLToPath } from "node:url"
import { NodeFileSystem } from "@effect/platform-node"
import { Migrator } from "@effect/sql"
import { fromFileSystem } from "@effect/sql/Migrator/FileSystem"
import { PgClient } from "@effect/sql-pg"
import { Config, Layer } from "effect"

const migrationsDir = fileURLToPath(new URL("migrations", import.meta.url))

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
})

const migrator = Migrator.make({})

export const DatabaseLive = migrator({
  loader: fromFileSystem(migrationsDir),
}).pipe(Layer.effectDiscard, Layer.provideMerge(PgLive), Layer.provide(NodeFileSystem.layer))
