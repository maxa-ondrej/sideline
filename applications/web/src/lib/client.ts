import {
  FetchHttpClient,
  HttpApi,
  HttpApiClient,
  HttpClient,
  HttpClientRequest,
} from '@effect/platform';
import {
  ActivityLogApi,
  ActivityStatsApi,
  AgeThresholdApi,
  Auth,
  DashboardApi,
  EventApi,
  EventRsvpApi,
  EventSeriesApi,
  GroupApi,
  ICalApi,
  Invite,
  LeaderboardApi,
  NotificationApi,
  RoleApi,
  Roster,
  TeamSettingsApi,
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
  .add(ActivityLogApi.ActivityLogApiGroup)
  .add(ActivityStatsApi.ActivityStatsApiGroup)
  .add(AgeThresholdApi.AgeThresholdApiGroup)
  .add(Auth.AuthApiGroup)
  .add(DashboardApi.DashboardApiGroup)
  .add(Invite.InviteApiGroup)
  .add(LeaderboardApi.LeaderboardApiGroup)
  .add(NotificationApi.NotificationApiGroup)
  .add(RoleApi.RoleApiGroup)
  .add(Roster.RosterApiGroup)
  .add(EventApi.EventApiGroup)
  .add(EventRsvpApi.EventRsvpApiGroup)
  .add(EventSeriesApi.EventSeriesApiGroup)
  .add(GroupApi.GroupApiGroup)
  .add(ICalApi.ICalApiGroup)
  .add(TeamSettingsApi.TeamSettingsApiGroup)
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
