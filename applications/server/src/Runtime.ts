import { DevTools } from '@effect/experimental';
import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { env } from './env.js';

const LogLayer =
  env.NODE_ENV === 'production'
    ? Layer.mergeAll(Logger.json, Logger.minimumLogLevel(LogLevel.Info))
    : Layer.mergeAll(Logger.pretty, Logger.minimumLogLevel(LogLevel.Debug));

const DevToolsLayer = env.NODE_ENV === 'production' ? Layer.empty : DevTools.layer();

const RuntimeLayer = Layer.mergeAll(LogLayer, DevToolsLayer);

export const runMain = <A, E>(effect: Effect.Effect<A, E>): void =>
  NodeRuntime.runMain(Effect.provide(effect, RuntimeLayer), { disablePrettyLogger: true });
