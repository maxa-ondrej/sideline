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
import { getToken } from './auth';

export const API_URL = 'http://localhost:3001';

class ClientApi extends HttpApi.make('api').add(AuthApiGroup).add(InviteApiGroup) {}

export const client = HttpApiClient.make(ClientApi, {
  baseUrl: API_URL,
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
