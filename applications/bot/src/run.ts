import { NodeHttpClient, NodeRuntime, NodeSocket } from '@effect/platform-node';
import * as DiscordConfig from 'dfx/DiscordConfig';
import { Config, Effect, Layer, Logger, LogLevel } from 'effect';
import { AppLive, Bot } from './index.js';

const MainLive = AppLive.pipe(
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(
    DiscordConfig.layerConfig({
      token: Config.redacted('DISCORD_BOT_TOKEN'),
    }),
  ),
  Layer.provide(Logger.json),
  Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
);

Effect.provide(Bot.program, MainLive).pipe(NodeRuntime.runMain);
