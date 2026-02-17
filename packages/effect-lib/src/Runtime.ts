import { DevTools } from '@effect/experimental';
import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel, Option, Schema } from 'effect';

export const NodeEnvSchema = Schema.OptionFromNullishOr(Schema.String, null).pipe(
  Schema.transform(Schema.Literal('production', 'development'), {
    strict: true,
    decode: (raw) => (Option.contains(raw, 'production') ? 'production' : 'development'),
    encode: Option.some,
  }),
);

const LogLayer = (env: 'development' | 'production') =>
  env === 'production'
    ? Layer.mergeAll(Logger.json, Logger.minimumLogLevel(LogLevel.Info))
    : Layer.mergeAll(Logger.pretty, Logger.minimumLogLevel(LogLevel.Debug));

const DevToolsLayer = (env: 'development' | 'production') =>
  env === 'production' ? Layer.empty : DevTools.layer();

const RuntimeLayer = (env: 'development' | 'production') =>
  Layer.mergeAll(LogLayer(env), DevToolsLayer(env));

export const runMain =
  (env: 'development' | 'production') =>
  <A, E>(effect: Effect.Effect<A, E>): void =>
    NodeRuntime.runMain(Effect.provide(effect, RuntimeLayer(env)), { disablePrettyLogger: true });
