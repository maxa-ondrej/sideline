import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, type LogLevel, Option, References } from 'effect';
import { DevTools } from 'effect/unstable/devtools';

const LogLayer = (logLevel: Option.Option<LogLevel.LogLevel>) =>
  Layer.mergeAll(
    Logger.layer([Logger.consolePretty()]),
    Layer.succeed(
      References.MinimumLogLevel,
      Option.getOrElse(logLevel, () => 'Info' as const),
    ),
  );

const DevToolsLayer = (env: 'development' | 'production') =>
  env === 'production' ? Layer.empty : DevTools.layer();

const RuntimeLayer = (
  env: 'development' | 'production',
  logLevel: Option.Option<LogLevel.LogLevel>,
  additionalLayers: Layer.Layer<never> = Layer.empty,
) => Layer.mergeAll(LogLayer(logLevel), DevToolsLayer(env), additionalLayers);

export const runMain =
  (
    env: 'development' | 'production',
    logLevel: Option.Option<LogLevel.LogLevel> = Option.none(),
    additionalLayers: Layer.Layer<never> = Layer.empty,
  ) =>
  // biome-ignore lint/suspicious/noExplicitAny: entry-point — requirements are fully provided by the caller
  <A, E, R = never>(effect: Effect.Effect<A, E, R>): void =>
    NodeRuntime.runMain(
      Effect.provide(effect, RuntimeLayer(env, logLevel, additionalLayers)) as Effect.Effect<
        A,
        E,
        never
      >,
    );
