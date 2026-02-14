import { createServer } from "node:http"
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DatabaseLive } from "@sideline/migrations"
import { Layer, Logger, LogLevel } from "effect"
import { ApiLive } from "./Api.js"
import { TodosRepository } from "./TodosRepository.js"

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(TodosRepository.Default),
  Layer.provide(DatabaseLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  Layer.provide(Logger.json),
  Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
