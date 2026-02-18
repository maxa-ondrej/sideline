import {
  FetchHttpClient,
  HttpApi,
  HttpApiClient,
  HttpClient,
  HttpClientRequest,
} from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { InviteApiGroup } from '@sideline/domain/api/Invite';
import { Context, Effect, Option } from 'effect';
import { getToken } from './auth';

export type ClientConfigService = {
  readonly baseUrl: string;
};

export type ClientConfig = { readonly _tag: 'api/ClientConfig' };

export const ClientConfig = Context.GenericTag<ClientConfig, ClientConfigService>(
  'api/ClientConfig',
);

class ClientApi extends HttpApi.make('api').add(AuthApiGroup).add(InviteApiGroup) {}

export const client = ClientConfig.pipe(
  Effect.flatMap(({ baseUrl }) =>
    HttpApiClient.make(ClientApi, {
      baseUrl: baseUrl,
      transformClient: (client) =>
        HttpClient.mapRequestEffect(client, (request) =>
          Effect.map(
            getToken,
            Option.match({
              onSome: (token) => HttpClientRequest.bearerToken(request, token),
              onNone: () => request,
            }),
          ),
        ),
    }),
  ),
  Effect.provide(FetchHttpClient.layer),
);
