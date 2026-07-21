import { Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getInfo, HealthApi, HealthApiLive } from '~/HealthServerLive.js';

const TestLayer = HttpApiBuilder.layer(HealthApi).pipe(
  Layer.provide(HealthApiLive),
  Layer.provideMerge(HttpServer.layerServices),
);

describe('health endpoints', () => {
  let app: ReturnType<typeof HttpRouter.toWebHandler>;
  let dispose: () => Promise<void>;

  beforeAll(() => {
    app = HttpRouter.toWebHandler(TestLayer);
    dispose = app.dispose;
  });

  afterAll(async () => {
    await dispose();
  });

  it('returns 200 ok for /health', async () => {
    const response = await (app.handler as (request: Request) => Promise<Response>)(
      new Request('http://localhost/health'),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  it('returns 200 ok for /healthz', async () => {
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
    expect(typeof body.version).toBe('string');
    expect(typeof body.commit).toBe('string');
    expect(body.build_time === null || typeof body.build_time === 'string').toBe(true);
  });
});

describe('getInfo', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
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
