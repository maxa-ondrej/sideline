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
import { DiscordOAuth } from '../src/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as TeamId;

const makeTestUser = (overrides?: Record<string, unknown>) => ({
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
  ...overrides,
});

const testUser = makeTestUser();

const testTeam = {
  id: TEST_TEAM_ID,
  name: 'Test Team',
  created_by: TEST_USER_ID,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const sessionsStore = new Map<string, UserId>();
sessionsStore.set('user-token', TEST_USER_ID);

const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {
  _tag: 'api/DiscordOAuth',
  createAuthorizationURL: (_state: string) =>
    Effect.succeed(new URL('https://discord.com/oauth2/authorize?client_id=test')),
  validateAuthorizationCode: () =>
    Effect.succeed(
      new OAuth2Tokens({ access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' }),
    ),
});

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  _tag: 'api/UsersRepository',
  findById: (id: UserId) =>
    Effect.succeed(id === TEST_USER_ID ? Option.some(testUser) : Option.none()),
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: (input) => {
    Object.assign(testUser, {
      name: input.name,
      birth_year: input.birth_year,
      gender: input.gender,
      jersey_number: input.jersey_number,
      position: input.position,
      proficiency: input.proficiency,
      is_profile_complete: true,
    });
    return Effect.succeed(testUser);
  },
  updateLocale: (input) => {
    Object.assign(testUser, { locale: input.locale });
    return Effect.succeed(testUser);
  },
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

const MockHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify({ id: '12345', username: 'testuser', avatar: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
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

describe('Profile Completion API', () => {
  it('POST /auth/profile without token returns 401', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1995,
          gender: 'male',
          position: 'midfielder',
          proficiency: 'intermediate',
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('POST /auth/profile with valid data completes profile', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1995,
          gender: 'male',
          position: 'midfielder',
          proficiency: 'intermediate',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Test User');
    expect(body.birthYear).toBe(1995);
    expect(body.gender).toBe('male');
    expect(body.position).toBe('midfielder');
    expect(body.proficiency).toBe('intermediate');
    expect(body.isProfileComplete).toBe(true);
    expect(body.jerseyNumber).toBeNull();
  });

  it('POST /auth/profile with jersey number includes it', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1995,
          gender: 'female',
          jerseyNumber: 10,
          position: 'forward',
          proficiency: 'advanced',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.jerseyNumber).toBe(10);
    expect(body.gender).toBe('female');
    expect(body.position).toBe('forward');
    expect(body.proficiency).toBe('advanced');
  });

  it('POST /auth/profile with invalid gender returns 400', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1995,
          gender: 'invalid',
          position: 'midfielder',
          proficiency: 'intermediate',
        }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it('POST /auth/profile with invalid position returns 400', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1995,
          gender: 'male',
          position: 'striker',
          proficiency: 'intermediate',
        }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it('POST /auth/profile with birth year out of range returns 400', async () => {
    const response = await handler(
      new Request('http://localhost/auth/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          birthYear: 1800,
          gender: 'male',
          position: 'midfielder',
          proficiency: 'intermediate',
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
