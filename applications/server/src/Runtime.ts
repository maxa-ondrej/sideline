import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { env } from './env.js';

const LogLayer =
  env.NODE_ENV === 'production'
    ? Layer.mergeAll(Logger.json, Logger.minimumLogLevel(LogLevel.Info))
    : Layer.mergeAll(Logger.pretty, Logger.minimumLogLevel(LogLevel.Debug));

export const runMain = <A, E>(effect: Effect.Effect<A, E>): void =>
  NodeRuntime.runMain(Effect.provide(effect, LogLayer), { disablePrettyLogger: true });
