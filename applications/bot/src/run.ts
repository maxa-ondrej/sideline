import { NodeHttpClient, NodeSocket } from '@effect/platform-node';
import * as DiscordConfig from 'dfx/DiscordConfig';
import { Config, Effect, Layer } from 'effect';
import { env } from './env.js';
import { AppLive, Bot } from './index.js';
import { runMain } from './Runtime.js';

const MainLive = AppLive.pipe(
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(
    DiscordConfig.layerConfig({
      token: Config.succeed(env.DISCORD_BOT_TOKEN),
    }),
  ),
);

Effect.provide(Bot.program, MainLive).pipe(runMain);
