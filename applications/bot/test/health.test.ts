import { DiscordGateway } from 'dfx/gateway';
import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BotHealthApi, getInfo } from '~/HealthServerLive.js';

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
      .handle('info', () =>
        Effect.succeed({
          version: 'dev',
          commit: 'unknown',
          build_time: null,
        }),
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

    it('returns 200 ok for /healthz even without shards connected', async () => {
      const response = await (app.handler as (request: Request) => Promise<Response>)(
        new Request('http://localhost/healthz'),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    it('returns 200 with the contract shape for /info', async () => {
      const response = await (app.handler as (request: Request) => Promise<Response>)(
        new Request('http://localhost/info'),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ version: 'dev', commit: 'unknown', build_time: null });
    });
  });
});

describe('getInfo', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_VERSION;
    delete process.env.GIT_COMMIT;
    delete process.env.BUILD_TIME;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses env-provided commit and build_time when set', () => {
    process.env.GIT_COMMIT = 'abc1234';
    process.env.BUILD_TIME = '2026-07-21T00:00:00Z';

    const info = getInfo();

    expect(info.commit).toBe('abc1234');
    expect(info.build_time).toBe('2026-07-21T00:00:00Z');
  });

  it('falls back to contract defaults when env vars are unset', () => {
    const info = getInfo();

    expect(info.commit).toBe('unknown');
    expect(info.build_time).toBeNull();
    expect(typeof info.version).toBe('string');
  });
});
