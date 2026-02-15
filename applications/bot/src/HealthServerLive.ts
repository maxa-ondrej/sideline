import { createServer } from "node:http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"

class HealthApiGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("healthCheck", "/health").addSuccess(
    Schema.Struct({ status: Schema.Literal("ok") }),
  ),
) {}

export class BotHealthApi extends HttpApi.make("bot-health").add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(BotHealthApi, "health", (handlers) =>
  Effect.succeed(handlers.handle("healthCheck", () => Effect.succeed({ status: "ok" as const }))),
)

export const HealthServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiBuilder.api(BotHealthApi)),
  Layer.provide(HealthApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
)
