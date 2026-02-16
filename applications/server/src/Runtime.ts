import { NodeRuntime } from '@effect/platform-node';
import { Config, Effect, Layer, Logger, LogLevel } from 'effect';

const LogLayer = Layer.unwrapEffect(
  Config.string('NODE_ENV').pipe(
    Config.withDefault('development'),
    Effect.map((env) =>
      env === 'production'
        ? Layer.mergeAll(Logger.json, Logger.minimumLogLevel(LogLevel.Info))
        : Layer.mergeAll(Logger.pretty, Logger.minimumLogLevel(LogLevel.Debug)),
    ),
  ),
);

export const runMain = <A, E>(effect: Effect.Effect<A, E>): void =>
  NodeRuntime.runMain(Effect.provide(effect, LogLayer), { disablePrettyLogger: true });
