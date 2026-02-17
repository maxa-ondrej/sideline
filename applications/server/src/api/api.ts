import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { InviteApiGroup } from '@sideline/domain/api/Invite';
import { Schema } from 'effect';
import { InternalError } from './errors.js';

export class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(
    Schema.Struct({ status: Schema.Literal('ok') }),
  ),
) {}

export class Api extends HttpApi.make('api')
  .add(HealthApiGroup)
  .add(AuthApiGroup)
  .add(InviteApiGroup)
  .addError(InternalError) {}
