import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Role, RosterModel as RosterNS, Team, TeamMember } from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { SubgroupsRepository } from '~/repositories/SubgroupsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { RosterEntry, TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_ROSTER_ID = '00000000-0000-0000-0000-000000000030' as RosterNS.RosterId;
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const ADMIN_PERMISSIONS =
  'team:manage,team:invite,roster:view,roster:manage,member:view,member:edit,member:remove,role:view,role:manage';
const PLAYER_PERMISSIONS = 'roster:view,member:view';

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

const membersStore = new Map<string, MembershipWithRole>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  role_names: 'Player',
  permissions: PLAYER_PERMISSIONS,
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  active: true,
  role_names: 'Admin',
  permissions: ADMIN_PERMISSIONS,
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
  roleNames: string,
  permissions: string,
): RosterEntry => {
  const user = usersMap.get(userId);
  if (!user) throw new Error(`User ${userId} not found in usersMap`);
  return new RosterEntry({
    member_id: memberId,
    user_id: userId,
    role_names: roleNames,
    permissions,
    name: user.name,
    birth_year: user.birth_year,
    gender: user.gender,
    jersey_number: null,
    discord_username: user.discord_username,
    discord_avatar: user.discord_avatar,
  });
};

// In-memory roster store
type RosterRecord = {
  id: RosterNS.RosterId;
  team_id: Team.TeamId;
  name: string;
  active: boolean;
  created_at: DateTime.Utc;
};

type RosterMemberRecord = {
  roster_id: RosterNS.RosterId;
  team_member_id: TeamMember.TeamMemberId;
};

const rostersStore = new Map<RosterNS.RosterId, RosterRecord>();
rostersStore.set(TEST_ROSTER_ID, {
  id: TEST_ROSTER_ID,
  team_id: TEST_TEAM_ID,
  name: 'Test Roster',
  active: true,
  created_at: DateTime.unsafeNow(),
});

const rosterMembersStore = new Map<string, RosterMemberRecord>();

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
    const member: MembershipWithRole = {
      id,
      team_id: input.team_id,
      user_id: input.user_id,
      active: input.active,
      role_names: 'Player',
      permissions: PLAYER_PERMISSIONS,
    };
    membersStore.set(id, member);
    return Effect.succeed({
      id,
      team_id: input.team_id,
      user_id: input.user_id,
      active: input.active,
      jersey_number: null,
      joined_at: DateTime.unsafeNow(),
    });
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
      Array.from(membersStore.values())
        .filter((m) => m.team_id === teamId && m.active)
        .map((m) => ({
          id: m.id,
          team_id: m.team_id,
          user_id: m.user_id,
          active: m.active,
          jersey_number: null,
          joined_at: DateTime.unsafeNow(),
        })),
    ),
  findByUser: (userId) =>
    Effect.succeed(Array.from(membersStore.values()).filter((m) => m.user_id === userId)),
  findRosterByTeam: (teamId) =>
    Effect.succeed(
      Array.from(membersStore.values())
        .filter((m) => m.team_id === teamId && m.active)
        .map((m) => buildRosterEntry(m.id, m.user_id, m.role_names, m.permissions)),
    ),
  findRosterMember: (input) => {
    const member = membersStore.get(input.member_id as TeamMember.TeamMemberId);
    if (!member || member.team_id !== input.team_id || !member.active) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(
      Option.some(
        buildRosterEntry(member.id, member.user_id, member.role_names, member.permissions),
      ),
    );
  },
  findRosterMemberByIds: (teamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId || !member.active) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(
      Option.some(
        buildRosterEntry(member.id, member.user_id, member.role_names, member.permissions),
      ),
    );
  },
  deactivateMember: (input) => {
    const member = membersStore.get(input.member_id as TeamMember.TeamMemberId);
    if (!member) return Effect.die(new Error('Member not found'));
    const updated = { ...member, active: false };
    membersStore.set(input.member_id as TeamMember.TeamMemberId, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      user_id: updated.user_id,
      active: updated.active,
      jersey_number: null,
      joined_at: DateTime.unsafeNow(),
    });
  },
  deactivateMemberByIds: (teamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId) return Effect.die(new Error('Member not found'));
    const updated = { ...member, active: false };
    membersStore.set(memberId, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      user_id: updated.user_id,
      active: updated.active,
      jersey_number: null,
      joined_at: DateTime.unsafeNow(),
    });
  },
  findPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  getPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  assignRoleToMember: () => Effect.void,
  unassignRoleFromMember: () => Effect.void,
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  updateJerseyNumber: () => Effect.void,
  setJerseyNumber: () => Effect.void,
});

const MockRostersRepositoryLayer = Layer.succeed(RostersRepository, {
  _tag: 'api/RostersRepository',
  findByTeam: (teamId: string) => {
    const rosters = Array.from(rostersStore.values()).filter((r) => r.team_id === teamId);
    return Effect.succeed(
      rosters.map((r) => ({
        id: r.id,
        team_id: r.team_id,
        name: r.name,
        active: r.active,
        created_at: r.created_at,
        member_count: Array.from(rosterMembersStore.values()).filter((rm) => rm.roster_id === r.id)
          .length,
      })),
    );
  },
  findByTeamId: (teamId: Team.TeamId) => {
    const rosters = Array.from(rostersStore.values()).filter((r) => r.team_id === teamId);
    return Effect.succeed(
      rosters.map((r) => ({
        id: r.id,
        team_id: r.team_id,
        name: r.name,
        active: r.active,
        created_at: r.created_at,
        member_count: Array.from(rosterMembersStore.values()).filter((rm) => rm.roster_id === r.id)
          .length,
      })),
    );
  },
  findById: (id: RosterNS.RosterId) => {
    const roster = rostersStore.get(id);
    return Effect.succeed(roster ? Option.some(roster) : Option.none());
  },
  findRosterById: (id: RosterNS.RosterId) => {
    const roster = rostersStore.get(id);
    return Effect.succeed(roster ? Option.some(roster) : Option.none());
  },
  insert: (input: { team_id: string; name: string; active: boolean }) => {
    const id = crypto.randomUUID() as RosterNS.RosterId;
    const roster: RosterRecord = {
      id,
      team_id: input.team_id as Team.TeamId,
      name: input.name,
      active: input.active,
      created_at: DateTime.unsafeNow(),
    };
    rostersStore.set(id, roster);
    return Effect.succeed(roster);
  },
  update: (input: { id: RosterNS.RosterId; name: string | null; active: boolean | null }) => {
    const roster = rostersStore.get(input.id);
    if (!roster) return Effect.die(new Error('Roster not found'));
    const updated = {
      ...roster,
      name: input.name ?? roster.name,
      active: input.active ?? roster.active,
    };
    rostersStore.set(input.id, updated);
    return Effect.succeed(updated);
  },
  delete: (id: RosterNS.RosterId) => {
    rostersStore.delete(id);
    return Effect.void;
  },
  findMemberEntries: (input: { roster_id: RosterNS.RosterId }) => {
    const memberIds = Array.from(rosterMembersStore.values())
      .filter((rm) => rm.roster_id === input.roster_id)
      .map((rm) => rm.team_member_id);
    const entries = memberIds.flatMap((memberId) => {
      const member = membersStore.get(memberId);
      if (!member) return [];
      return [buildRosterEntry(member.id, member.user_id, member.role_names, member.permissions)];
    });
    return Effect.succeed(entries);
  },
  findMemberEntriesById: (rosterId: RosterNS.RosterId) => {
    const memberIds = Array.from(rosterMembersStore.values())
      .filter((rm) => rm.roster_id === rosterId)
      .map((rm) => rm.team_member_id);
    const entries = memberIds.flatMap((memberId) => {
      const member = membersStore.get(memberId);
      if (!member) return [];
      return [buildRosterEntry(member.id, member.user_id, member.role_names, member.permissions)];
    });
    return Effect.succeed(entries);
  },
  addMember: (input: { roster_id: RosterNS.RosterId; team_member_id: TeamMember.TeamMemberId }) => {
    const key = `${input.roster_id}:${input.team_member_id}`;
    rosterMembersStore.set(key, {
      roster_id: input.roster_id,
      team_member_id: input.team_member_id,
    });
    return Effect.void;
  },
  addMemberById: (rosterId: RosterNS.RosterId, teamMemberId: TeamMember.TeamMemberId) => {
    const key = `${rosterId}:${teamMemberId}`;
    rosterMembersStore.set(key, { roster_id: rosterId, team_member_id: teamMemberId });
    return Effect.void;
  },
  removeMember: (input: {
    roster_id: RosterNS.RosterId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    const key = `${input.roster_id}:${input.team_member_id}`;
    rosterMembersStore.delete(key);
    return Effect.void;
  },
  removeMemberById: (rosterId: RosterNS.RosterId, teamMemberId: TeamMember.TeamMemberId) => {
    const key = `${rosterId}:${teamMemberId}`;
    rosterMembersStore.delete(key);
    return Effect.void;
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

const MockRolesRepositoryLayer = Layer.succeed(RolesRepository, {
  _tag: 'api/RolesRepository',
  findByTeamId: () => Effect.succeed([]),
  findRolesByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findRoleById: () => Effect.succeed(Option.none()),
  findPermissions: () => Effect.succeed([]),
  getPermissionsForRoleId: () => Effect.succeed([]),
  insert: () => Effect.die(new Error('Not implemented')),
  insertRole: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateRole: () => Effect.die(new Error('Not implemented')),
  deleteRole: () => Effect.void,
  deleteRoleById: () => Effect.void,
  deletePermissions: () => Effect.void,
  insertPermission: () => Effect.void,
  setRolePermissions: () => Effect.void,
  initTeamRoles: () => Effect.void,
  initializeTeamRoles: () => Effect.void,
  findByTeamAndName: () => Effect.succeed(Option.none()),
  findRoleByTeamAndName: () => Effect.succeed(Option.none()),
  seedTeamRolesWithPermissions: () => Effect.succeed([]),
  countMembersForRole: () => Effect.succeed({ count: 0 }),
  getMemberCountForRole: () => Effect.succeed(0),
});

const MockSubgroupsRepositoryLayer = Layer.succeed(SubgroupsRepository, {
  _tag: 'api/SubgroupsRepository',
  findByTeamId: () => Effect.succeed([]),
  findSubgroupsByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findSubgroupById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertSubgroup: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateSubgroup: () => Effect.die(new Error('Not implemented')),
  deleteSubgroup: () => Effect.void,
  deleteSubgroupById: () => Effect.void,
  findMembers: () => Effect.succeed([]),
  findMembersBySubgroupId: () => Effect.succeed([]),
  addMember: () => Effect.void,
  addMemberById: () => Effect.void,
  removeMember: () => Effect.void,
  removeMemberById: () => Effect.void,
  findPermissions: () => Effect.succeed([]),
  getPermissionsForSubgroupId: () => Effect.succeed([]),
  deletePermissions: () => Effect.void,
  insertPermission: () => Effect.void,
  setSubgroupPermissions: () => Effect.void,
  countMembersForSubgroup: () => Effect.succeed({ count: 0 }),
  getMemberCount: () => Effect.succeed(0),
});

const MockTrainingTypesRepositoryLayer = Layer.succeed(TrainingTypesRepository, {
  _tag: 'api/TrainingTypesRepository',
  findByTeamId: () => Effect.succeed([]),
  findTrainingTypesByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findTrainingTypeById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertTrainingType: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateTrainingType: () => Effect.die(new Error('Not implemented')),
  deleteTrainingType: () => Effect.void,
  deleteTrainingTypeById: () => Effect.void,
  findCoaches: () => Effect.succeed([]),
  findCoachesByTrainingTypeId: () => Effect.succeed([]),
  addCoach: () => Effect.void,
  addCoachById: () => Effect.void,
  removeCoach: () => Effect.void,
  removeCoachById: () => Effect.void,
  countCoachesForTrainingType: () => Effect.succeed({ count: 0 }),
  getCoachCount: () => Effect.succeed(0),
} as unknown as TrainingTypesRepository);

const MockAgeThresholdRepositoryLayer = Layer.succeed(AgeThresholdRepository, {
  findByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  updateRule: () => Effect.die(new Error('Not implemented')),
  deleteRule: () => Effect.void,
  findAllTeamsWithRules: () => Effect.succeed([]),
  findMembersWithBirthYears: () => Effect.succeed([]),
  findRulesByTeamId: () => Effect.succeed([]),
  findRuleById: () => Effect.succeed(Option.none()),
  insertRule: () => Effect.die(new Error('Not implemented')),
  updateRuleById: () => Effect.die(new Error('Not implemented')),
  deleteRuleById: () => Effect.void,
  getAllTeamsWithRules: () => Effect.succeed([]),
  getMembersWithBirthYears: () => Effect.succeed([]),
} as unknown as AgeThresholdRepository);

const MockNotificationsRepositoryLayer = Layer.succeed(NotificationsRepository, {
  findByUserId: () => Effect.succeed([]),
  insertOne: () => Effect.die(new Error('Not implemented')),
  markOneAsRead: () => Effect.void,
  markAllRead: () => Effect.void,
  findOneById: () => Effect.succeed(Option.none()),
  findByUser: () => Effect.succeed([]),
  insert: () => Effect.die(new Error('Not implemented')),
  insertBulk: () => Effect.void,
  markAsRead: () => Effect.void,
  markAllAsRead: () => Effect.void,
  findById: () => Effect.succeed(Option.none()),
} as unknown as NotificationsRepository);

const MockAgeCheckServiceLayer = Layer.succeed(AgeCheckService, {
  evaluateTeam: () => Effect.succeed([]),
  evaluate: () => Effect.succeed([]),
} as unknown as AgeCheckService);

const MockRoleSyncEventsRepositoryLayer = Layer.succeed(RoleSyncEventsRepository, {
  emitIfGuildLinked: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as RoleSyncEventsRepository);

const TestLayer = ApiLive.pipe(
  Layer.provideMerge(AuthMiddlewareLive),
  Layer.provideMerge(HttpServer.layerContext),
  Layer.provide(MockDiscordOAuthLayer),
  Layer.provide(MockUsersRepositoryLayer),
  Layer.provide(MockSessionsRepositoryLayer),
  Layer.provide(MockTeamsRepositoryLayer),
  Layer.provide(MockTeamMembersRepositoryLayer),
  Layer.provide(MockRostersRepositoryLayer),
  Layer.provide(MockTeamInvitesRepositoryLayer),
  Layer.provide(MockRolesRepositoryLayer),
  Layer.provide(MockSubgroupsRepositoryLayer),
  Layer.provide(MockTrainingTypesRepositoryLayer),
  Layer.provide(MockHttpClientLayer),
  Layer.provide(MockAgeCheckServiceLayer),
  Layer.provide(MockAgeThresholdRepositoryLayer),
  Layer.provide(MockNotificationsRepositoryLayer),
  Layer.provide(MockRoleSyncEventsRepositoryLayer),
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

describe('Members API', () => {
  describe('GET /teams/:teamId/members', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(`http://localhost/teams/${TEST_TEAM_ID}/members`));
      expect(response.status).toBe(401);
    });

    it('returns 403 for non-member', async () => {
      const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${nonMemberTeamId}/members`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 200 with player list for member', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members`, {
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

  describe('GET /teams/:teamId/members/:memberId', () => {
    it('returns 200 for member accessing own roster entry', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${TEST_MEMBER_ID}`, {
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
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${unknownMemberId}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 403 for non-member of team', async () => {
      const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${nonMemberTeamId}/members/${TEST_MEMBER_ID}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /teams/:teamId/members/:memberId', () => {
    it('returns 200 for admin updating player', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${TEST_MEMBER_ID}`, {
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
          }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.memberId).toBe(TEST_MEMBER_ID);
    });

    it('returns 403 for regular member trying to update', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${TEST_MEMBER_ID}`, {
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
          }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /teams/:teamId/members/:memberId', () => {
    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${TEST_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown member', async () => {
      const unknownMemberId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${unknownMemberId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 204 for admin deactivating player', async () => {
      // Re-activate the member first
      membersStore.set(TEST_MEMBER_ID, {
        id: TEST_MEMBER_ID,
        team_id: TEST_TEAM_ID,
        user_id: TEST_USER_ID,
        active: true,
        role_names: 'Player',
        permissions: PLAYER_PERMISSIONS,
      });
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/members/${TEST_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });
  });
});

describe('Rosters API', () => {
  describe('GET /teams/:teamId/rosters', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`));
      expect(response.status).toBe(401);
    });

    it('returns 403 for non-member', async () => {
      const nonMemberTeamId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${nonMemberTeamId}/rosters`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 200 with roster list for member', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('POST /teams/:teamId/rosters', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Roster' }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Roster' }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 201 for admin creating roster', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Roster' }),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('New Roster');
      expect(body.active).toBe(true);
      expect(body.memberCount).toBe(0);
    });
  });

  describe('GET /teams/:teamId/rosters/:rosterId', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}`),
      );
      expect(response.status).toBe(401);
    });

    it('returns 404 for unknown roster', async () => {
      const unknownRosterId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${unknownRosterId}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 200 with roster detail for member', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.rosterId).toBe(TEST_ROSTER_ID);
      expect(body.name).toBe('Test Roster');
      expect(Array.isArray(body.members)).toBe(true);
    });
  });

  describe('PATCH /teams/:teamId/rosters/:rosterId', () => {
    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated', active: null }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 200 for admin updating roster', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Roster', active: null }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Updated Roster');
    });

    it('returns 404 for unknown roster', async () => {
      const unknownRosterId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${unknownRosterId}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: null, active: false }),
        }),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /teams/:teamId/rosters/:rosterId', () => {
    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown roster', async () => {
      const unknownRosterId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${unknownRosterId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 204 for admin deleting roster', async () => {
      // Create a roster to delete
      const createResponse = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'To Delete' }),
        }),
      );
      const created = await createResponse.json();
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${created.rosterId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });
  });

  describe('POST /teams/:teamId/rosters/:rosterId/members', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}/members`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown roster', async () => {
      const unknownRosterId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${unknownRosterId}/members`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 204 for admin adding member', async () => {
      // Ensure member is active
      membersStore.set(TEST_MEMBER_ID, {
        id: TEST_MEMBER_ID,
        team_id: TEST_TEAM_ID,
        user_id: TEST_USER_ID,
        active: true,
        role_names: 'Player',
        permissions: PLAYER_PERMISSIONS,
      });
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}/members`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(204);
    });
  });

  describe('DELETE /teams/:teamId/rosters/:rosterId/members/:memberId', () => {
    it('returns 403 for non-admin', async () => {
      const response = await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}/members/${TEST_MEMBER_ID}`,
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer user-token' },
          },
        ),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown roster', async () => {
      const unknownRosterId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/rosters/${unknownRosterId}/members/${TEST_MEMBER_ID}`,
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer admin-token' },
          },
        ),
      );
      expect(response.status).toBe(404);
    });

    it('returns 204 for admin removing member', async () => {
      // Ensure member is in roster
      const key = `${TEST_ROSTER_ID}:${TEST_MEMBER_ID}`;
      rosterMembersStore.set(key, {
        roster_id: TEST_ROSTER_ID,
        team_member_id: TEST_MEMBER_ID,
      });
      membersStore.set(TEST_MEMBER_ID, {
        id: TEST_MEMBER_ID,
        team_id: TEST_TEAM_ID,
        user_id: TEST_USER_ID,
        active: true,
        role_names: 'Player',
        permissions: PLAYER_PERMISSIONS,
      });
      const response = await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/rosters/${TEST_ROSTER_ID}/members/${TEST_MEMBER_ID}`,
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer admin-token' },
          },
        ),
      );
      expect(response.status).toBe(204);
    });
  });
});
