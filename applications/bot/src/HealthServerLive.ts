import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { DiscordGateway } from 'dfx/gateway';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { env } from '~/env.js';

const HealthResponse = Schema.Struct({
  status: Schema.Literals(['ok', 'degraded']),
  shards: Schema.Number,
});

class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health', {
    success: HealthResponse,
  }),
) {}

export class BotHealthApi extends HttpApi.make('bot-health').add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(BotHealthApi, 'health', (handlers) =>
  Effect.succeed(
    handlers.handle('healthCheck', () =>
      Effect.Do.pipe(
        Effect.bind('gateway', () => DiscordGateway.asEffect()),
        Effect.bind('shards', ({ gateway }) => gateway.shards),
        Effect.map(({ shards }) => ({
          status: shards.size > 0 ? ('ok' as const) : ('degraded' as const),
          shards: shards.size,
        })),
      ),
    ),
  ),
);

export const HealthServerLive = HttpRouter.serve(
  Layer.mergeAll(HttpApiBuilder.layer(BotHealthApi), HealthApiLive),
).pipe(
  Layer.withSpan('Health'),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.HEALTH_PORT })),
);
