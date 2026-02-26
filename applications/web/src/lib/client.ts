import {
  FetchHttpClient,
  HttpApi,
  HttpApiClient,
  HttpClient,
  HttpClientRequest,
} from '@effect/platform';
import {
  AgeThresholdApi,
  Auth,
  Invite,
  NotificationApi,
  RoleApi,
  Roster,
  SubgroupApi,
  TrainingTypeApi,
} from '@sideline/domain';
import { Context, Effect, Option } from 'effect';
import { getToken } from '~/lib/auth';

export type ClientConfigService = {
  readonly baseUrl: string;
};

export type ClientConfig = { readonly _tag: 'api/ClientConfig' };

export const ClientConfig = Context.GenericTag<ClientConfig, ClientConfigService>(
  'api/ClientConfig',
);

class ClientApi extends HttpApi.make('api')
  .add(AgeThresholdApi.AgeThresholdApiGroup)
  .add(Auth.AuthApiGroup)
  .add(Invite.InviteApiGroup)
  .add(NotificationApi.NotificationApiGroup)
  .add(Roster.RosterApiGroup)
  .add(RoleApi.RoleApiGroup)
  .add(SubgroupApi.SubgroupApiGroup)
  .add(TrainingTypeApi.TrainingTypeApiGroup) {}

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
