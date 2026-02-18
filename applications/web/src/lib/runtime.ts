import { type LinkOptions, notFound, redirect } from '@tanstack/react-router';
import { Context, Data, Effect, Either, Layer, Logger, LogLevel } from 'effect';
import { ClientConfig, client } from './client';

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
  async (
    effect: Effect.Effect<A, ClientError | Redirect | NotFound, ApiClient | ClientConfig>,
  ): Promise<A> => {
    const baseUrl = await fetch('/config')
      .then((response) => response.json())
      .then(({ SERVER_URL }) => SERVER_URL);
    const effectResponse = effect.pipe(
      Effect.either,
      Effect.provide(AppLayer),
      Effect.provideService(ClientConfig, {
        baseUrl,
      }),
    );
    const response = await Effect.runPromise(effectResponse, abortController);
    return Either.match(response, {
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
    });
  };
