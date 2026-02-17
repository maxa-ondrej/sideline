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
const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002' as UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as TeamId;

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

const testAdmin = {
  id: TEST_ADMIN_ID,
  discord_id: '67890',
  discord_username: 'adminuser',
  discord_avatar: null,
  discord_access_token: 'admin-token',
  discord_refresh_token: null,
  is_profile_complete: true,
  name: 'Admin User',
  birth_year: 1990,
  gender: 'male' as const,
  jersey_number: 7,
  position: 'midfielder' as const,
  proficiency: 'advanced' as const,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testTeam = {
  id: TEST_TEAM_ID,
  name: 'Test Team',
  created_by: TEST_ADMIN_ID,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const sessionsStore = new Map<string, UserId>();
sessionsStore.set('user-token', TEST_USER_ID);
sessionsStore.set('admin-token', TEST_ADMIN_ID);

const membersStore = new Map<
  string,
  {
    id: TeamMemberId;
    team_id: TeamId;
    user_id: UserId;
    role: 'admin' | 'member';
    joined_at: DateTime.Utc;
  }
>();
membersStore.set(`${TEST_TEAM_ID}:${TEST_ADMIN_ID}`, {
  id: '00000000-0000-0000-0000-000000000020' as TeamMemberId,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  role: 'admin',
  joined_at: DateTime.unsafeNow(),
});

const invitesStore = new Map<
  string,
  {
    id: TeamInviteId;
    team_id: TeamId;
    code: string;
    active: boolean;
    created_by: UserId;
    created_at: DateTime.Utc;
    expires_at: DateTime.Utc | null;
  }
>();
invitesStore.set('valid-invite', {
  id: '00000000-0000-0000-0000-000000000030' as TeamInviteId,
  team_id: TEST_TEAM_ID,
  code: 'valid-invite',
  active: true,
  created_by: TEST_ADMIN_ID,
  created_at: DateTime.unsafeNow(),
  expires_at: null,
});
invitesStore.set('inactive-invite', {
  id: '00000000-0000-0000-0000-000000000031' as TeamInviteId,
  team_id: TEST_TEAM_ID,
  code: 'inactive-invite',
  active: false,
  created_by: TEST_ADMIN_ID,
  created_at: DateTime.unsafeNow(),
  expires_at: null,
});

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
  findById: (id: UserId) => {
    if (id === TEST_USER_ID) return Effect.succeed(Option.some(testUser));
    if (id === TEST_ADMIN_ID) return Effect.succeed(Option.some(testAdmin));
    return Effect.succeed(Option.none());
  },
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

const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  _tag: 'api/TeamsRepository',
  findById: (id: TeamId) => {
    if (id === TEST_TEAM_ID) return Effect.succeed(Option.some(testTeam));
    return Effect.succeed(Option.none());
  },
  insert: () => Effect.succeed(testTeam),
});

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  _tag: 'api/TeamMembersRepository',
  addMember: (input) => {
    const key = `${input.team_id}:${input.user_id}`;
    const member = {
      id: crypto.randomUUID() as TeamMemberId,
      team_id: input.team_id,
      user_id: input.user_id,
      role: input.role,
      joined_at: DateTime.unsafeNow(),
    };
    membersStore.set(key, member);
    return Effect.succeed(member);
  },
  findMembership: (input) => {
    const key = `${input.team_id}:${input.user_id}`;
    const member = membersStore.get(key);
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findMembershipByIds: (teamId: TeamId, userId: UserId) => {
    const key = `${teamId}:${userId}`;
    const member = membersStore.get(key);
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
});

const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
  findByCode: (code) => {
    const invite = invitesStore.get(code);
    if (invite?.active) return Effect.succeed(Option.some(invite));
    return Effect.succeed(Option.none());
  },
  findByTeam: (teamId) =>
    Effect.succeed(Array.from(invitesStore.values()).filter((i) => i.team_id === teamId)),
  create: (input) => {
    const invite = {
      id: crypto.randomUUID() as TeamInviteId,
      team_id: input.team_id,
      code: input.code,
      active: input.active,
      created_by: input.created_by,
      created_at: DateTime.unsafeNow(),
      expires_at: input.expires_at,
    };
    invitesStore.set(invite.code, invite);
    return Effect.succeed(invite);
  },
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

describe('Invite API', () => {
  it('GET /invite/:code returns team info for valid invite', async () => {
    const response = await handler(new Request('http://localhost/invite/valid-invite'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teamName).toBe('Test Team');
    expect(body.teamId).toBe(TEST_TEAM_ID);
    expect(body.code).toBe('valid-invite');
  });

  it('GET /invite/:code returns 404 for unknown invite', async () => {
    const response = await handler(new Request('http://localhost/invite/nonexistent'));
    expect(response.status).toBe(404);
  });

  it('GET /invite/:code returns 404 for inactive invite', async () => {
    const response = await handler(new Request('http://localhost/invite/inactive-invite'));
    expect(response.status).toBe(404);
  });

  it('POST /invite/:code/join without token returns 401', async () => {
    const response = await handler(
      new Request('http://localhost/invite/valid-invite/join', { method: 'POST' }),
    );
    expect(response.status).toBe(401);
  });

  it('POST /invite/:code/join with valid token joins team', async () => {
    const response = await handler(
      new Request('http://localhost/invite/valid-invite/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teamId).toBe(TEST_TEAM_ID);
    expect(body.role).toBe('member');
    expect(body.isProfileComplete).toBe(false);
  });

  it('POST /invite/:code/join when already a member returns 409', async () => {
    const response = await handler(
      new Request('http://localhost/invite/valid-invite/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(response.status).toBe(409);
  });

  it('POST /invite/:code/join with invalid code returns 404', async () => {
    const response = await handler(
      new Request('http://localhost/invite/nonexistent/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(response.status).toBe(404);
  });

  it('POST /teams/:id/invite/regenerate by admin returns new invite', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/invite/regenerate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBeDefined();
    expect(body.active).toBe(true);
  });

  it('POST /teams/:id/invite/regenerate by non-admin returns 403', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/invite/regenerate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(response.status).toBe(403);
  });

  it('POST /teams/:id/invite/regenerate by non-member returns 403', async () => {
    const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
    const response = await handler(
      new Request(`http://localhost/teams/${nonMemberTeamId}/invite/regenerate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    expect(response.status).toBe(403);
  });

  it('DELETE /teams/:id/invite by admin returns 204', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/invite`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    expect(response.status).toBe(204);
  });

  it('DELETE /teams/:id/invite by non-admin returns 403', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/invite`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(response.status).toBe(403);
  });
});
