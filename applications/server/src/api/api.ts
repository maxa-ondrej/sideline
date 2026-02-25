import { HttpApi } from '@effect/platform';
import {
  AgeThresholdApi,
  Auth,
  Invite,
  NotificationApi,
  RoleApi,
  Roster,
  SubgroupApi,
} from '@sideline/domain';
import { env } from '~/env.js';

export class Api extends HttpApi.make('api')
  .add(AgeThresholdApi.AgeThresholdApiGroup)
  .add(Auth.AuthApiGroup)
  .add(Invite.InviteApiGroup)
  .add(NotificationApi.NotificationApiGroup)
  .add(Roster.RosterApiGroup)
  .add(RoleApi.RoleApiGroup)
  .add(SubgroupApi.SubgroupApiGroup)
  .pipe((api) =>
    env.API_PREFIX.startsWith('/') ? api.prefix(env.API_PREFIX as '/${string}') : api,
  ) {}
