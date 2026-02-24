import { type LinkOptions, notFound, redirect } from '@tanstack/react-router';
import { Context, Data, Effect, Either, Layer, Logger, LogLevel, Match, type Option } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { ClientConfig, client } from '~/lib/client';

export class ClientError extends Data.TaggedError('ClientError')<{
  readonly message: string;
}> {
  static make = (message: string) => new ClientError({ message });
}

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

export type Run = <A>(
  effect: Effect.Effect<A, ClientError, ApiClient | ClientConfig>,
) => Promise<Option.Option<A>>;

const RunContext = React.createContext<Run>(
  () => new Promise((_, reject) => reject('Not implemented')),
);

export const RunProvider = RunContext.Provider;

export const useRun = () => React.useContext(RunContext);

export const runPromiseServer =
  (serverUrl: string) =>
  (abortController?: AbortController) =>
  async <A>(
    effect: Effect.Effect<A, Redirect | NotFound, ApiClient | ClientConfig>,
  ): Promise<A> => {
    const effectResponse = effect.pipe(
      Effect.either,
      Effect.provide(AppLayer),
      Effect.provideService(ClientConfig, {
        baseUrl: serverUrl,
      }),
    );
    const response = await Effect.runPromise(effectResponse, abortController);
    return Either.match(response, {
      onRight: (d) => d,
      onLeft: (e) => {
        throw Match.value(e).pipe(
          Match.tag('Redirect', (e) => redirect(e.linkOptions)),
          Match.tag('NotFound', () => notFound()),
          Match.exhaustive,
        );
      },
    });
  };

export const runPromiseClient =
  (serverUrl: string) =>
  async <A>(
    effect: Effect.Effect<A, ClientError, ApiClient | ClientConfig>,
  ): Promise<Option.Option<A>> => {
    const effectResponse = effect.pipe(
      Effect.provide(AppLayer),
      Effect.provideService(ClientConfig, {
        baseUrl: serverUrl,
      }),
      Effect.tapError((e) => Effect.sync(() => toast.error(e.message))),
      Effect.option,
    );
    return await Effect.runPromise(effectResponse);
  };
