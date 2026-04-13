import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer, Schema } from 'effect';
import { HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { env } from '~/env.js';

class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health', {
    success: Schema.Struct({ status: Schema.Literal('ok') }),
  }),
) {}

class HealthApi extends HttpApi.make('health').add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(HealthApi, 'health', (handlers) =>
  Effect.succeed(handlers.handle('healthCheck', () => Effect.succeed({ status: 'ok' as const }))),
);

export const HealthServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiBuilder.api(HealthApi)),
  Layer.provide(HealthApiLive),
  Layer.withSpan('Health'),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.HEALTH_PORT })),
);
