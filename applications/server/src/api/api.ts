import { HttpApi } from '@effect/platform';
import {
  AgeThresholdApi,
  Auth,
  EventApi,
  GroupApi,
  Invite,
  NotificationApi,
  RoleApi,
  Roster,
  TrainingTypeApi,
} from '@sideline/domain';
import { env } from '~/env.js';

export class Api extends HttpApi.make('api')
  .add(AgeThresholdApi.AgeThresholdApiGroup)
  .add(Auth.AuthApiGroup)
  .add(EventApi.EventApiGroup)
  .add(GroupApi.GroupApiGroup)
  .add(Invite.InviteApiGroup)
  .add(NotificationApi.NotificationApiGroup)
  .add(Roster.RosterApiGroup)
  .add(RoleApi.RoleApiGroup)
  .add(TrainingTypeApi.TrainingTypeApiGroup)
  .pipe((api) =>
    env.API_PREFIX.startsWith('/') ? api.prefix(env.API_PREFIX as '/${string}') : api,
  ) {}
