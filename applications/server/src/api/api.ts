import { HttpApi } from '@effect/platform';
import { Auth, Invite } from '@sideline/domain';
import { env } from '~/env.js';

export class Api extends HttpApi.make('api')
  .add(Auth.AuthApiGroup)
  .add(Invite.InviteApiGroup)
  .pipe((api) =>
    env.API_PREFIX.startsWith('/') ? api.prefix(env.API_PREFIX as '/${string}') : api,
  ) {}
