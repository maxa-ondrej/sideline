import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { InviteApiGroup } from '@sideline/domain/api/Invite';
import { Schema } from 'effect';
import { env } from '../env.js';
import { InternalError } from './errors.js';

export class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(
    Schema.Struct({ status: Schema.Literal('ok') }),
  ),
) {}

export class Api extends HttpApi.make('api')
  .add(AuthApiGroup)
  .add(InviteApiGroup)
  .pipe((api) =>
    env.API_PREFIX.startsWith('/') ? api.prefix(env.API_PREFIX as '/${string}') : api,
  )
  .add(HealthApiGroup)
  .addError(InternalError) {}
