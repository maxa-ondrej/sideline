import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { UserId } from '@sideline/domain/api/Auth';
import type { TeamId } from '@sideline/domain/models/Team';
import type { TeamInviteId } from '@sideline/domain/models/TeamInvite';
import type { TeamMemberId } from '@sideline/domain/models/TeamMember';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiLive } from '../src/api/index.js';
import { AuthMiddlewareLive } from '../src/middleware/AuthMiddlewareLive.js';
import { SessionsRepository } from '../src/repositories/SessionsRepository.js';
import { TeamInvitesRepository } from '../src/repositories/TeamInvitesRepository.js';
import { TeamMembersRepository } from '../src/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '../src/repositories/TeamsRepository.js';
import { UsersRepository } from '../src/repositories/UsersRepository.js';
import { DiscordOAuth, DiscordOAuthError } from '../src/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as TeamId;
const _FRONTEND_URL = 'http://localhost:5173';

const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  discord_username: 'testuser',
  discord_avatar: null,
  discord_access_token: 'token',
  discord_refresh_token: null,
  is_profile_complete: false,
  name: null,
  birth_year: null,
  gender: null,
  jersey_number: null,
  position: null,
  proficiency: null,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testTeam = {
  id: TEST_TEAM_ID,
  name: 'Test Team',
  created_by: TEST_USER_ID,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const sessionsStore = new Map<string, UserId>();
sessionsStore.set('pre-existing-token', TEST_USER_ID);

const mockTokens = (access: string, refresh: string) =>
  new OAuth2Tokens({ access_token: access, refresh_token: refresh });

const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {
  _tag: 'api/DiscordOAuth',
  createAuthorizationURL: (_state: string) =>
    Effect.succeed(new URL('https://discord.com/oauth2/authorize?client_id=test')),
  validateAuthorizationCode: (code: string) =>
    code === 'valid-code'
      ? Effect.succeed(mockTokens('mock-access-token', 'mock-refresh-token'))
      : Effect.fail(new DiscordOAuthError({ cause: new Error('Invalid code') })),
});

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  _tag: 'api/UsersRepository',
  findById: (id: UserId) =>
    Effect.succeed(id === TEST_USER_ID ? Option.some(testUser) : Option.none()),
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
});

const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  _tag: 'api/SessionsRepository',
  create: (input) => {
    sessionsStore.set(input.token, input.user_id);
    return Effect.succeed({
      id: 'session-1',
      user_id: input.user_id,
      token: input.token,
      expires_at: DateTime.unsafeNow(),
      created_at: DateTime.unsafeNow(),
    });
  },
  findByToken: (token) => {
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
  deleteByToken: () => Effect.void,
});

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

const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  _tag: 'api/TeamsRepository',
  findById: () => Effect.succeed(Option.none()),
  insert: () => Effect.succeed(testTeam),
});

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  _tag: 'api/TeamMembersRepository',
  addMember: () =>
    Effect.succeed({
      id: '00000000-0000-0000-0000-000000000020' as TeamMemberId,
      team_id: TEST_TEAM_ID,
      user_id: TEST_USER_ID,
      role: 'member' as const,
      joined_at: DateTime.unsafeNow(),
    }),
  findMembership: () => Effect.succeed(Option.none()),
  findMembershipByIds: () => Effect.succeed(Option.none()),
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
});

const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
  findByCode: () => Effect.succeed(Option.none()),
  findByTeam: () => Effect.succeed([]),
  create: () =>
    Effect.succeed({
      id: '00000000-0000-0000-0000-000000000030' as TeamInviteId,
      team_id: TEST_TEAM_ID,
      code: 'test-code',
      active: true,
      created_by: TEST_USER_ID,
      created_at: DateTime.unsafeNow(),
      expires_at: null,
    }),
  deactivateByTeam: () => Effect.void,
  deactivateByTeamExcept: () => Effect.void,
});

const TestLayer = ApiLive.pipe(
  Layer.provideMerge(AuthMiddlewareLive),
  Layer.provideMerge(HttpServer.layerContext),
  Layer.provide(MockDiscordOAuthLayer),
  Layer.provide(MockUsersRepositoryLayer),
  Layer.provide(MockSessionsRepositoryLayer),
  Layer.provide(MockTeamsRepositoryLayer),
  Layer.provide(MockTeamMembersRepositoryLayer),
  Layer.provide(MockTeamInvitesRepositoryLayer),
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
    const response = await handler(
      new Request(
        'http://localhost/auth/callback?code=bad&state=%7B%22id%22%3A%22d5760fa3-5440-4f87-8136-f5c1109aaea0%22%2C%20%22redirectUrl%22%3A%22http%3A%2F%2Flocalhost%2Fredirect%22%7D',
      ),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('reason=oauth_failed');
  });

  it('GET /auth/callback with valid code redirects with token', async () => {
    const response = await handler(
      new Request(
        'http://localhost/auth/callback?code=valid-code&state=%7B%22id%22%3A%22d5760fa3-5440-4f87-8136-f5c1109aaea0%22%2C%20%22redirectUrl%22%3A%22http%3A%2F%2Flocalhost%2Fredirect%22%7D',
      ),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('http://localhost/redirect?token=');
  });
});
