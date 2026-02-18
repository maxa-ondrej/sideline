import {
  FetchHttpClient,
  HttpApi,
  HttpApiClient,
  HttpClient,
  HttpClientRequest,
} from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { InviteApiGroup } from '@sideline/domain/api/Invite';
import { Effect, Option } from 'effect';
import { env } from '../env';
import { getToken } from './auth';

class ClientApi extends HttpApi.make('api').add(AuthApiGroup).add(InviteApiGroup) {}

export const client = HttpApiClient.make(ClientApi, {
  baseUrl: env.VITE_SERVER_URL,
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
}).pipe(Effect.provide(FetchHttpClient.layer));
