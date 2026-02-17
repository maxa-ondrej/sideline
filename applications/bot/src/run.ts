import { NodeHttpClient, NodeSocket } from '@effect/platform-node';
import { Runtime } from '@sideline/effect-lib';
import * as DiscordConfig from 'dfx/DiscordConfig';
import { Config, Effect, Layer } from 'effect';
import { env } from './env.js';
import { AppLive, Bot } from './index.js';

const MainLive = AppLive.pipe(
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(
    DiscordConfig.layerConfig({
      token: Config.succeed(env.DISCORD_BOT_TOKEN),
    }),
  ),
);

Effect.provide(Bot.program, MainLive).pipe(Runtime.runMain(env.NODE_ENV));
