import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { UserId } from '@sideline/domain/api/Auth';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiLive } from '../src/api/index.js';
import { AuthMiddlewareLive } from '../src/middleware/AuthMiddlewareLive.js';
import { SessionsRepository } from '../src/repositories/SessionsRepository.js';
import { UsersRepository } from '../src/repositories/UsersRepository.js';
import { DiscordOAuth, DiscordOAuthError } from '../src/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as UserId;
const FRONTEND_URL = 'http://localhost:5173';

const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  discord_username: 'testuser',
  discord_avatar: null,
  discord_access_token: 'token',
  discord_refresh_token: null,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const sessionsStore = new Map<string, UserId>();
sessionsStore.set('pre-existing-token', TEST_USER_ID);

const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {
  createAuthorizationURL: (_state: string) =>
    Effect.succeed(new URL('https://discord.com/oauth2/authorize?client_id=test')),
  validateAuthorizationCode: (code: string) =>
    code === 'valid-code'
      ? Effect.succeed({
          accessToken: () => 'mock-access-token',
          refreshToken: () => 'mock-refresh-token',
        })
      : Effect.fail(new DiscordOAuthError({ cause: new Error('Invalid code') })),
} as any);

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  findById: (id: UserId) =>
    Effect.succeed(id === TEST_USER_ID ? Option.some(testUser) : Option.none()),
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
} as any);

const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  create: (input: { user_id: UserId; token: string; expires_at: unknown }) => {
    sessionsStore.set(input.token, input.user_id);
    return Effect.succeed({
      id: 'session-1',
      user_id: input.user_id,
      token: input.token,
      expires_at: DateTime.unsafeNow(),
      created_at: DateTime.unsafeNow(),
    });
  },
  findByToken: (token: string) => {
    const userId = sessionsStore.get(token);
    if (!userId) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some({
        id: 'session-1',
        user_id: userId,
        token,
        expires_at: DateTime.unsafeNow(),
        created_at: DateTime.unsafeNow(),
      }),
    );
  },
  deleteByToken: (token: string) => {
    sessionsStore.delete(token);
    return Effect.succeed(undefined as undefined);
  },
} as any);

const MockHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(
          JSON.stringify({
            id: '12345',
            username: 'testuser',
            avatar: null,
            discriminator: '0',
            public_flags: 0,
            flags: 0,
            mfa_enabled: false,
            locale: 'en-US',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    ),
  ),
);

const TestLayer = ApiLive.pipe(
  Layer.provideMerge(AuthMiddlewareLive),
  Layer.provideMerge(HttpServer.layerContext),
  Layer.provide(MockDiscordOAuthLayer),
  Layer.provide(MockUsersRepositoryLayer),
  Layer.provide(MockSessionsRepositoryLayer),
  Layer.provide(MockHttpClientLayer),
);

let handler: (request: Request) => Promise<Response>;
let dispose: () => Promise<void>;

beforeAll(() => {
  const app = HttpApiBuilder.toWebHandler(TestLayer);
  handler = app.handler;
  dispose = app.dispose;
});

afterAll(async () => {
  await dispose();
});

describe('Auth API', () => {
  it('GET /health returns 200 with status ok', async () => {
    const response = await handler(new Request('http://localhost/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /auth/me without token returns 401', async () => {
    const response = await handler(new Request('http://localhost/auth/me'));
    expect(response.status).toBe(401);
  });

  it('GET /auth/me with valid session returns user', async () => {
    const response = await handler(
      new Request('http://localhost/auth/me', {
        headers: { Authorization: 'Bearer pre-existing-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.discordUsername).toBe('testuser');
  });

  it('GET /auth/login redirects to Discord OAuth', async () => {
    const response = await handler(new Request('http://localhost/auth/login'));
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('discord.com/oauth2/authorize');
  });

  it('GET /auth/callback with no params redirects with reason=missing_params', async () => {
    const response = await handler(new Request('http://localhost/auth/callback'));
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('reason=missing_params');
  });

  it('GET /auth/callback?error=access_denied redirects with reason=access_denied', async () => {
    const response = await handler(
      new Request('http://localhost/auth/callback?error=access_denied'),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('reason=access_denied');
  });

  it('GET /auth/callback with bad code redirects with reason=oauth_failed', async () => {
    const response = await handler(new Request('http://localhost/auth/callback?code=bad&state=x'));
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('reason=oauth_failed');
  });

  it('GET /auth/callback with valid code redirects with token', async () => {
    const response = await handler(
      new Request('http://localhost/auth/callback?code=valid-code&state=x'),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain(`${FRONTEND_URL}/?token=`);
  });
});
