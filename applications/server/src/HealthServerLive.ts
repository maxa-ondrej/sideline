import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { env } from '~/env.js';
import { APP_VERSION } from '~/version.js';

const InfoResponse = Schema.Struct({
  version: Schema.String,
  commit: Schema.String,
  build_time: Schema.NullOr(Schema.String),
});

export const getInfo = (): typeof InfoResponse.Type => {
  const commit = process.env.GIT_COMMIT;
  const buildTime = process.env.BUILD_TIME;
  return {
    version: APP_VERSION,
    commit: commit !== undefined && commit !== '' ? commit : 'unknown',
    build_time: buildTime !== undefined && buildTime !== '' ? buildTime : null,
  };
};

class HealthApiGroup extends HttpApiGroup.make('health')
  .add(
    HttpApiEndpoint.get('healthCheck', '/health', {
      success: Schema.Struct({ status: Schema.Literal('ok') }),
    }),
  )
  .add(
    HttpApiEndpoint.get('healthz', '/healthz', {
      success: Schema.Struct({ status: Schema.Literal('ok') }),
    }),
  )
  .add(
    HttpApiEndpoint.get('info', '/info', {
      success: InfoResponse,
    }),
  ) {}

export class HealthApi extends HttpApi.make('health').add(HealthApiGroup) {}

export const HealthApiLive = HttpApiBuilder.group(HealthApi, 'health', (handlers) =>
  Effect.succeed(
    handlers
      .handle('healthCheck', () => Effect.succeed({ status: 'ok' as const }))
      .handle('healthz', () => Effect.succeed({ status: 'ok' as const }))
      .handle('info', () => Effect.succeed(getInfo())),
  ),
);

export const HealthServerLive = HttpRouter.serve(
  HttpApiBuilder.layer(HealthApi).pipe(Layer.provide(HealthApiLive)),
).pipe(
  Layer.withSpan('Health'),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.HEALTH_PORT })),
);
