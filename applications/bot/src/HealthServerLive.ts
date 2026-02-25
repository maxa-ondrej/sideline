import { createServer } from 'node:http';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpServer,
} from '@effect/platform';
import { NodeHttpServer } from '@effect/platform-node';
import { DiscordGateway } from 'dfx/gateway';
import { Effect, Layer, Schema } from 'effect';
import { env } from '~/env.js';

const HealthResponse = Schema.Struct({
  status: Schema.Literal('ok', 'degraded'),
  shards: Schema.Number,
});

class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(HealthResponse),
) {}

export class BotHealthApi extends HttpApi.make('bot-health').add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(BotHealthApi, 'health', (handlers) =>
  Effect.succeed(
    handlers.handle('healthCheck', () =>
      Effect.Do.pipe(
        Effect.bind('gateway', () => DiscordGateway),
        Effect.bind('shards', ({ gateway }) => gateway.shards),
        Effect.map(({ shards }) => ({
          status: shards.size > 0 ? ('ok' as const) : ('degraded' as const),
          shards: shards.size,
        })),
      ),
    ),
  ),
);

export const HealthServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiBuilder.api(BotHealthApi)),
  Layer.provide(HealthApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.HEALTH_PORT })),
);
