import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Team, TeamMember } from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import { RosterEntry, TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;

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

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('user-token', TEST_USER_ID);
sessionsStore.set('admin-token', TEST_ADMIN_ID);

const membersStore = new Map<
  string,
  {
    id: TeamMember.TeamMemberId;
    team_id: Team.TeamId;
    user_id: Auth.UserId;
    role: 'admin' | 'member';
    active: boolean;
    joined_at: DateTime.Utc;
  }
>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  role: 'member',
  active: true,
  joined_at: DateTime.unsafeNow(),
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  role: 'admin',
  active: true,
  joined_at: DateTime.unsafeNow(),
});

type UserLike = {
  id: Auth.UserId;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  discord_access_token: string;
  discord_refresh_token: string | null;
  is_profile_complete: boolean;
  name: string | null;
  birth_year: number | null;
  gender: 'male' | 'female' | 'other' | null;
  jersey_number: number | null;
  position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | null;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'pro' | null;
  locale: 'en' | 'cs';
  created_at: DateTime.Utc;
  updated_at: DateTime.Utc;
};

const usersMap = new Map<Auth.UserId, UserLike>();
usersMap.set(TEST_USER_ID, testUser);
usersMap.set(TEST_ADMIN_ID, testAdmin);

const buildRosterEntry = (
  memberId: TeamMember.TeamMemberId,
  userId: Auth.UserId,
  role: 'admin' | 'member',
): RosterEntry => {
  const user = usersMap.get(userId)!;
  return new RosterEntry({
    member_id: memberId,
    user_id: userId,
    role,
    name: user.name,
    birth_year: user.birth_year,
    gender: user.gender,
    jersey_number: user.jersey_number,
    position: user.position,
    proficiency: user.proficiency,
    discord_username: user.discord_username,
    discord_avatar: user.discord_avatar,
  });
};

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
  findById: (id: Auth.UserId) => {
    const user = usersMap.get(id);
    return Effect.succeed(user ? Option.some(user) : Option.none());
  },
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
  updateAdminProfile: (input) => {
    const user = usersMap.get(input.id);
    if (!user) return Effect.die(new Error('User not found'));
    const updated = {
      ...user,
      name: input.name,
      birth_year: input.birth_year,
      gender: input.gender,
      jersey_number: input.jersey_number,
      position: input.position,
      proficiency: input.proficiency,
    };
    usersMap.set(input.id, updated);
    return Effect.succeed(updated);
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
  findById: (id: Team.TeamId) => {
    if (id === TEST_TEAM_ID) return Effect.succeed(Option.some(testTeam));
    return Effect.succeed(Option.none());
  },
  insert: () => Effect.succeed(testTeam),
});

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  _tag: 'api/TeamMembersRepository',
  addMember: (input) => {
    const id = crypto.randomUUID() as TeamMember.TeamMemberId;
    const member = {
      id,
      team_id: input.team_id,
      user_id: input.user_id,
      role: input.role,
      active: input.active,
      joined_at: DateTime.unsafeNow(),
    };
    membersStore.set(id, member);
    return Effect.succeed(member);
  },
  findMembership: (input) => {
    const member = Array.from(membersStore.values()).find(
      (m) => m.team_id === input.team_id && m.user_id === input.user_id,
    );
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findMembershipByIds: (teamId: Team.TeamId, userId: Auth.UserId) => {
    const member = Array.from(membersStore.values()).find(
      (m) => m.team_id === teamId && m.user_id === userId,
    );
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findByTeam: (teamId) =>
    Effect.succeed(
      Array.from(membersStore.values()).filter((m) => m.team_id === teamId && m.active),
    ),
  findByUser: (userId) =>
    Effect.succeed(Array.from(membersStore.values()).filter((m) => m.user_id === userId)),
  findRosterByTeam: (teamId) =>
    Effect.succeed(
      Array.from(membersStore.values())
        .filter((m) => m.team_id === teamId && m.active)
        .map((m) => buildRosterEntry(m.id, m.user_id, m.role)),
    ),
  findRosterMember: (input) => {
    const member = membersStore.get(input.member_id as TeamMember.TeamMemberId);
    if (!member || member.team_id !== input.team_id || !member.active) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(Option.some(buildRosterEntry(member.id, member.user_id, member.role)));
  },
  findRosterMemberByIds: (teamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId || !member.active) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(Option.some(buildRosterEntry(member.id, member.user_id, member.role)));
  },
  deactivateMember: (input) => {
    const member = membersStore.get(input.member_id as TeamMember.TeamMemberId);
    if (!member) return Effect.die(new Error('Member not found'));
    const updated = { ...member, active: false };
    membersStore.set(input.member_id as TeamMember.TeamMemberId, updated);
    return Effect.succeed(updated);
  },
  deactivateMemberByIds: (teamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId) return Effect.die(new Error('Member not found'));
    const updated = { ...member, active: false };
    membersStore.set(memberId, updated);
    return Effect.succeed(updated);
  },
});

const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
  findByCode: () => Effect.succeed(Option.none()),
  findByTeam: () => Effect.succeed([]),
  create: () => Effect.die(new Error('Not implemented in roster tests')),
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

describe('Roster API', () => {
  describe('GET /teams/:teamId/roster', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster`));
      expect(response.status).toBe(401);
    });

    it('returns 403 for non-member', async () => {
      const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${nonMemberTeamId}/roster`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 200 with player list for member', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0].discordUsername).toBeDefined();
    });
  });

  describe('GET /teams/:teamId/roster/:memberId', () => {
    it('returns 200 for member accessing own roster entry', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${TEST_MEMBER_ID}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.memberId).toBe(TEST_MEMBER_ID);
    });

    it('returns 404 for unknown member', async () => {
      const unknownMemberId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${unknownMemberId}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 403 for non-member of team', async () => {
      const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${nonMemberTeamId}/roster/${TEST_MEMBER_ID}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /teams/:teamId/roster/:memberId', () => {
    it('returns 200 for admin updating player', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${TEST_MEMBER_ID}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Updated Name',
            birthYear: null,
            gender: null,
            jerseyNumber: null,
            position: null,
            proficiency: null,
          }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.memberId).toBe(TEST_MEMBER_ID);
    });

    it('returns 403 for regular member trying to update', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${TEST_MEMBER_ID}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Updated Name',
            birthYear: null,
            gender: null,
            jerseyNumber: null,
            position: null,
            proficiency: null,
          }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /teams/:teamId/roster/:memberId', () => {
    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${TEST_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown member', async () => {
      const unknownMemberId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${unknownMemberId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 204 for admin deactivating player', async () => {
      // Re-activate the member first (since previous test may have deactivated)
      membersStore.set(TEST_MEMBER_ID, {
        id: TEST_MEMBER_ID,
        team_id: TEST_TEAM_ID,
        user_id: TEST_USER_ID,
        role: 'member',
        active: true,
        joined_at: DateTime.unsafeNow(),
      });
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/roster/${TEST_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });
  });
});
