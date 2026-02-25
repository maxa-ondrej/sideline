import { NodeHttpClient, NodeSocket } from '@effect/platform-node';
import { RpcClient, RpcSerialization } from '@effect/rpc';
import { Runtime } from '@sideline/effect-lib';
import * as DiscordConfig from 'dfx/DiscordConfig';
import { Config, Effect, Layer } from 'effect';
import { env } from '~/env.js';
import { AppLive, Bot } from '~/index.js';

const RpcProtocol = RpcClient.layerProtocolHttp({
  url: `${env.SERVER_URL}/rpc/role-sync`,
}).pipe(Layer.provide(NodeHttpClient.layerUndici), Layer.provide(RpcSerialization.layerNdjson));

const MainLive = AppLive.pipe(
  Layer.provide(RpcProtocol),
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(
    DiscordConfig.layerConfig({
      token: Config.succeed(env.DISCORD_BOT_TOKEN),
      gateway: Config.succeed({ intents: env.DISCORD_GATEWAY_INTENTS }),
    }),
  ),
);

Effect.provide(Bot.program, MainLive).pipe(Runtime.runMain(env.NODE_ENV));
