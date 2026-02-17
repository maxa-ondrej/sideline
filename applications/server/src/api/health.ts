import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { AuthApiGroup } from '@sideline/domain/api/Auth';
import { Effect, Schema } from 'effect';

export class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(
    Schema.Struct({ status: Schema.Literal('ok') }),
  ),
) {}

export class Api extends HttpApi.make('api').add(HealthApiGroup).add(AuthApiGroup) {}

export const HealthApiLive = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('healthCheck', () => Effect.succeed({ status: 'ok' as const }))),
);
