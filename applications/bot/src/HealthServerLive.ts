import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { DiscordGateway } from 'dfx/gateway';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { env } from '~/env.js';
import { APP_VERSION } from '~/version.js';

const HealthResponse = Schema.Struct({
  status: Schema.Literals(['ok', 'degraded']),
  shards: Schema.Number,
});

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
      success: HealthResponse,
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

export class BotHealthApi extends HttpApi.make('bot-health').add(HealthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(BotHealthApi, 'health', (handlers) =>
  Effect.succeed(
    handlers
      .handle('healthCheck', () =>
        Effect.Do.pipe(
          Effect.bind('gateway', () => DiscordGateway.asEffect()),
          Effect.bind('shards', ({ gateway }) => gateway.shards),
          Effect.map(({ shards }) => ({
            status: shards.size > 0 ? ('ok' as const) : ('degraded' as const),
            shards: shards.size,
          })),
        ),
      )
      .handle('healthz', () => Effect.succeed({ status: 'ok' as const }))
      .handle('info', () => Effect.succeed(getInfo())),
  ),
);

export const HealthServerLive = HttpRouter.serve(
  HttpApiBuilder.layer(BotHealthApi).pipe(Layer.provide(HealthApiLive)),
).pipe(
  Layer.withSpan('Health'),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.HEALTH_PORT })),
);
