import { Context, Data, Effect, Layer, Logger, LogLevel } from 'effect';
import { client } from './client';

export class ClientError extends Data.TaggedError('ClientError')<{
  readonly message: string;
}> {}

type Client = Effect.Effect.Success<typeof client>;

export class ApiClient extends Context.Tag('ApiClient')<ApiClient, Client>() {}

const ApiClientLive = Layer.effect(ApiClient, client);

const AppLayer = Layer.mergeAll(
  ApiClientLive,
  Logger.pretty,
  Logger.minimumLogLevel(LogLevel.Info),
);

export const runPromise =
  <A>(abortController?: AbortController) =>
  (effect: Effect.Effect<A, ClientError, ApiClient>): Promise<A> =>
    effect.pipe(Effect.provide(AppLayer), (e) => Effect.runPromise(e, abortController));
