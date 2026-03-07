import { DevTools } from '@effect/experimental';
import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';

const LogLayer = (env: 'development' | 'production', logLevel: Option.Option<LogLevel.LogLevel>) =>
  Layer.mergeAll(
    env === 'production' ? Logger.json : Logger.pretty,
    Logger.minimumLogLevel(
      Option.getOrElse(logLevel, () => (env === 'production' ? LogLevel.Info : LogLevel.Debug)),
    ),
  );

const DevToolsLayer = (env: 'development' | 'production') =>
  env === 'production' ? Layer.empty : DevTools.layer();

const RuntimeLayer = (
  env: 'development' | 'production',
  logLevel: Option.Option<LogLevel.LogLevel>,
) => Layer.mergeAll(LogLayer(env, logLevel), DevToolsLayer(env));

export const runMain =
  (env: 'development' | 'production', logLevel: Option.Option<LogLevel.LogLevel> = Option.none()) =>
  <A, E>(effect: Effect.Effect<A, E>): void =>
    NodeRuntime.runMain(Effect.provide(effect, RuntimeLayer(env, logLevel)), {
      disablePrettyLogger: true,
    });
