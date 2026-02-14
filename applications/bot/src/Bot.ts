import { createServer } from "node:http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { NodeHttpClient, NodeHttpServer, NodeRuntime, NodeSocket } from "@effect/platform-node"
import * as DiscordConfig from "dfx/DiscordConfig"
import { DiscordIxLive, runIx } from "dfx/gateway"
import * as Ix from "dfx/Interactions/index"
import * as Discord from "dfx/types"
import { Config, Effect, Layer, Logger, LogLevel, Schema } from "effect"

const PingCommand = Ix.global(
  { name: "ping", description: "Check if the bot is alive" },
  Effect.succeed(
    Ix.response({
      type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Pong!" },
    }),
  ),
)

const commands = Effect.succeed(Ix.builder.add(PingCommand))

const program = commands.pipe(
  Effect.andThen(
    runIx((effect) =>
      Effect.catchAllCause(effect, (cause) => Effect.logError("Interaction error", cause)),
    ),
  ),
)

class HealthApiGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("healthCheck", "/health").addSuccess(
    Schema.Struct({ status: Schema.Literal("ok") }),
  ),
) {}

class BotHealthApi extends HttpApi.make("bot-health").add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(BotHealthApi, "health", (handlers) =>
  Effect.succeed(handlers.handle("healthCheck", () => Effect.succeed({ status: "ok" as const }))),
)

const HealthServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiBuilder.api(BotHealthApi)),
  Layer.provide(HealthApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
)

const MainLive = Layer.mergeAll(DiscordIxLive, HealthServerLive).pipe(
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(
    DiscordConfig.layerConfig({
      token: Config.redacted("DISCORD_BOT_TOKEN"),
    }),
  ),
  Layer.provide(Logger.json),
  Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
)

Effect.provide(program, MainLive).pipe(NodeRuntime.runMain)
