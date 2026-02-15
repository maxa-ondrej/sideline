import { createServer } from "node:http"
import { FetchHttpClient, HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { PgClient } from "@effect/sql-pg"
import { MigratorLive } from "@sideline/migrations"
import { Config, Layer, Logger, LogLevel } from "effect"
import { ApiLive } from "./Api.js"
import { AuthMiddlewareLive } from "./AuthMiddlewareLive.js"
import { DiscordOAuth } from "./DiscordOAuth.js"
import { SessionsRepository } from "./SessionsRepository.js"
import { UsersRepository } from "./UsersRepository.js"

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
})

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors({ credentials: true, allowedOrigins: () => true })),
  Layer.provide(MigratorLive),
  Layer.provide(ApiLive),
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(UsersRepository.Default),
  Layer.provide(SessionsRepository.Default),
  Layer.provide(DiscordOAuth.Default),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
  Layer.provide(Logger.json),
  Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
