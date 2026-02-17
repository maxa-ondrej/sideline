import { type LinkOptions, notFound, redirect } from '@tanstack/react-router';
import { Context, Data, Effect, Either, Layer, Logger, LogLevel } from 'effect';
import { client } from './client';

export class ClientError extends Data.TaggedError('ClientError')<{
  readonly message: string;
}> {}

type Client = Effect.Effect.Success<typeof client>;

export class ApiClient extends Context.Tag('ApiClient')<ApiClient, Client>() {}

export class Redirect extends Data.TaggedError('Redirect')<{
  readonly linkOptions: LinkOptions;
}> {
  static make = (linkOptions: LinkOptions) => new Redirect({ linkOptions });
}

export class NotFound extends Data.TaggedError('NotFound') {
  static make = () => new NotFound();
}

const ApiClientLive = Layer.effect(ApiClient, client);

const AppLayer = Layer.mergeAll(
  ApiClientLive,
  Logger.pretty,
  Logger.minimumLogLevel(LogLevel.Info),
);

export const runPromise =
  <A>(abortController?: AbortController) =>
  (effect: Effect.Effect<A, ClientError | Redirect | NotFound, ApiClient>): Promise<A> =>
    effect.pipe(Effect.either, Effect.provide(AppLayer), (e) =>
      Effect.runPromise(e, abortController).then(
        Either.match({
          onRight: (data) => data,
          onLeft: (e) => {
            if (e._tag === 'Redirect') {
              throw redirect(e.linkOptions);
            }
            if (e._tag === 'NotFound') {
              throw notFound();
            }
            throw e;
          },
        }),
      ),
    );
