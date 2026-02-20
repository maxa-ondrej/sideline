import { HttpApi } from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { InviteApiGroup } from '@sideline/domain/api/Invite';
import { env } from '../env.js';
import { InternalError } from './errors.js';

export class Api extends HttpApi.make('api')
  .add(AuthApiGroup)
  .add(InviteApiGroup)
  .addError(InternalError)
  .pipe((api) =>
    env.API_PREFIX.startsWith('/') ? api.prefix(env.API_PREFIX as '/${string}') : api,
  ) {}
