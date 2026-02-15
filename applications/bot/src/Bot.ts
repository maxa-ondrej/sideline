import { runIx } from "dfx/gateway"
import * as Ix from "dfx/Interactions/index"
import * as Discord from "dfx/types"
import { Effect } from "effect"

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

export const program = commands.pipe(
  Effect.andThen(
    runIx((effect) =>
      Effect.catchAllCause(effect, (cause) => Effect.logError("Interaction error", cause)),
    ),
  ),
)
