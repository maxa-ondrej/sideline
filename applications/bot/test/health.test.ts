import { DiscordGateway } from 'dfx/gateway';
import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BotHealthApi } from '~/HealthServerLive.js';

const makeMockGatewayLayer = (shardCount: number) =>
  Layer.succeed(DiscordGateway, {
    [DiscordGateway.key]: DiscordGateway.key,
    dispatch: undefined as never,
    fromDispatch: undefined as never,
    handleDispatch: undefined as never,
    send: undefined as never,
    shards: Effect.succeed(
      new Set(
        Array.from({ length: shardCount }, (_, i) => ({
          id: [i, shardCount] as [number, number],
          write: () => Effect.void,
        })),
      ),
    ),
  } as never);

const HealthApiGroupLive = HttpApiBuilder.group(BotHealthApi, 'health', (handlers) =>
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

const makeTestLayer = (shardCount: number) =>
  HttpApiBuilder.layer(BotHealthApi).pipe(
    Layer.provide(HealthApiGroupLive),
    Layer.provideMerge(HttpServer.layerServices),
    Layer.provide(makeMockGatewayLayer(shardCount)),
  );

describe('health endpoint', () => {
  describe('with shards connected', () => {
    let app: ReturnType<typeof HttpRouter.toWebHandler>;
    let dispose: () => Promise<void>;

    beforeAll(() => {
      app = HttpRouter.toWebHandler(makeTestLayer(2));
      dispose = app.dispose;
    });

    afterAll(async () => {
      await dispose();
    });

    it('returns ok status when shards are connected', async () => {
      const response = await (app.handler as (request: Request) => Promise<Response>)(
        new Request('http://localhost/health'),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.shards).toBe(2);
    });
  });

  describe('with no shards', () => {
    let app: ReturnType<typeof HttpRouter.toWebHandler>;
    let dispose: () => Promise<void>;

    beforeAll(() => {
      app = HttpRouter.toWebHandler(makeTestLayer(0));
      dispose = app.dispose;
    });

    afterAll(async () => {
      await dispose();
    });

    it('returns degraded status when no shards are connected', async () => {
      const response = await (app.handler as (request: Request) => Promise<Response>)(
        new Request('http://localhost/health'),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('degraded');
      expect(body.shards).toBe(0);
    });
  });
});
