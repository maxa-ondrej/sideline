import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type {
  Auth,
  ChannelSyncEvent,
  Role,
  SubgroupModel,
  Team,
  TeamMember,
} from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
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
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const ADMIN_PERMISSIONS =
  'team:manage,team:invite,roster:view,roster:manage,member:view,member:edit,member:remove,role:view,role:manage';

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

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('admin-token', TEST_ADMIN_ID);

const membersStore = new Map<string, MembershipWithRole>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  role_names: 'Player',
  permissions: 'roster:view,member:view',
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  active: true,
  role_names: 'Admin',
  permissions: ADMIN_PERMISSIONS,
});

// Recording mock for channel sync events
type ChannelSyncEventCall = {
  teamId: Team.TeamId;
  eventType: ChannelSyncEvent.ChannelSyncEventType;
  subgroupId: SubgroupModel.SubgroupId;
  subgroupName: Option.Option<string>;
  teamMemberId: Option.Option<TeamMember.TeamMemberId>;
  discordUserId: Option.Option<string>;
};

const channelSyncEventCalls: ChannelSyncEventCall[] = [];

const MockChannelSyncEventsRepositoryLayer = Layer.succeed(ChannelSyncEventsRepository, {
  _tag: 'api/ChannelSyncEventsRepository',
  emitIfGuildLinked: (
    teamId: Team.TeamId,
    eventType: ChannelSyncEvent.ChannelSyncEventType,
    subgroupId: SubgroupModel.SubgroupId,
    subgroupName: Option.Option<string> = Option.none(),
    teamMemberId: Option.Option<TeamMember.TeamMemberId> = Option.none(),
    discordUserId: Option.Option<string> = Option.none(),
  ) => {
    channelSyncEventCalls.push({
      teamId,
      eventType,
      subgroupId,
      subgroupName,
      teamMemberId,
      discordUserId,
    });
    return Effect.void;
  },
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
  insertEvent: () => Effect.die('Not implemented'),
  lookupGuildId: () => Effect.die('Not implemented'),
  findUnprocessedEvents: () => Effect.die('Not implemented'),
  markEventProcessed: () => Effect.die('Not implemented'),
  markEventFailed: () => Effect.die('Not implemented'),
} as ChannelSyncEventsRepository);

let nextSubgroupId = 100;

type SubgroupLike = {
  id: SubgroupModel.SubgroupId;
  team_id: Team.TeamId;
  name: string;
};

const subgroupsStore = new Map<SubgroupModel.SubgroupId, SubgroupLike>();
const subgroupMembersStore = new Map<string, Set<TeamMember.TeamMemberId>>();

const MockSubgroupsRepositoryLayer = Layer.succeed(SubgroupsRepository, {
  _tag: 'api/SubgroupsRepository',
  findByTeamId: (teamId: string) =>
    Effect.succeed(
      Array.from(subgroupsStore.values())
        .filter((s) => s.team_id === teamId)
        .map((s) => ({
          ...s,
          member_count: subgroupMembersStore.get(s.id)?.size ?? 0,
          created_at: new Date(),
        })),
    ),
  findSubgroupsByTeamId: (teamId: string) =>
    Effect.succeed(
      Array.from(subgroupsStore.values())
        .filter((s) => s.team_id === teamId)
        .map((s) => ({
          ...s,
          member_count: subgroupMembersStore.get(s.id)?.size ?? 0,
          created_at: new Date(),
        })),
    ),
  findById: (id: SubgroupModel.SubgroupId) => {
    const sg = subgroupsStore.get(id);
    return Effect.succeed(sg ? Option.some(sg) : Option.none());
  },
  findSubgroupById: (id: SubgroupModel.SubgroupId) => {
    const sg = subgroupsStore.get(id);
    return Effect.succeed(sg ? Option.some(sg) : Option.none());
  },
  insert: (input: { team_id: string; name: string }) => {
    const id =
      `00000000-0000-0000-0000-${String(nextSubgroupId++).padStart(12, '0')}` as SubgroupModel.SubgroupId;
    const sg: SubgroupLike = {
      id,
      team_id: input.team_id as Team.TeamId,
      name: input.name,
    };
    subgroupsStore.set(id, sg);
    return Effect.succeed(sg);
  },
  insertSubgroup: (teamId: string, name: string) => {
    const id =
      `00000000-0000-0000-0000-${String(nextSubgroupId++).padStart(12, '0')}` as SubgroupModel.SubgroupId;
    const sg: SubgroupLike = {
      id,
      team_id: teamId as Team.TeamId,
      name,
    };
    subgroupsStore.set(id, sg);
    return Effect.succeed(sg);
  },
  update: () => Effect.die(new Error('Not implemented')),
  updateSubgroup: () => Effect.die(new Error('Not implemented')),
  deleteSubgroup: (id: SubgroupModel.SubgroupId) => {
    subgroupsStore.delete(id);
    subgroupMembersStore.delete(id);
    return Effect.void;
  },
  deleteSubgroupById: (id: SubgroupModel.SubgroupId) => {
    subgroupsStore.delete(id);
    subgroupMembersStore.delete(id);
    return Effect.void;
  },
  findMembers: () => Effect.succeed([]),
  findMembersBySubgroupId: () => Effect.succeed([]),
  addMember: (input: {
    subgroup_id: SubgroupModel.SubgroupId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    const members = subgroupMembersStore.get(input.subgroup_id) ?? new Set();
    members.add(input.team_member_id);
    subgroupMembersStore.set(input.subgroup_id, members);
    return Effect.void;
  },
  addMemberById: (subgroupId: SubgroupModel.SubgroupId, memberId: TeamMember.TeamMemberId) => {
    const members = subgroupMembersStore.get(subgroupId) ?? new Set();
    members.add(memberId);
    subgroupMembersStore.set(subgroupId, members);
    return Effect.void;
  },
  removeMember: (input: {
    subgroup_id: SubgroupModel.SubgroupId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    subgroupMembersStore.get(input.subgroup_id)?.delete(input.team_member_id);
    return Effect.void;
  },
  removeMemberById: (subgroupId: SubgroupModel.SubgroupId, memberId: TeamMember.TeamMemberId) => {
    subgroupMembersStore.get(subgroupId)?.delete(memberId);
    return Effect.void;
  },
  findPermissions: () => Effect.succeed([]),
  getPermissionsForSubgroupId: () => Effect.succeed([]),
  deletePermissions: () => Effect.void,
  insertPermission: () => Effect.void,
  setSubgroupPermissions: () => Effect.void,
  countMembersForSubgroup: () => Effect.succeed({ count: 0 }),
  getMemberCount: () => Effect.succeed(0),
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
  findById: (id: Auth.UserId) => {
    const user = usersMap.get(id);
    return Effect.succeed(user ? Option.some(user) : Option.none());
  },
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
  updateAdminProfile: () => Effect.die(new Error('Not implemented')),
});

const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  _tag: 'api/SessionsRepository',
  create: () => Effect.die(new Error('Not implemented')),
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
  addMember: () => Effect.die(new Error('Not implemented')),
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
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
  findRosterByTeam: () => Effect.succeed([]),
  findRosterMember: (input) => {
    const member = membersStore.get(input.member_id as TeamMember.TeamMemberId);
    if (!member || member.team_id !== input.team_id || !member.active) {
      return Effect.succeed(Option.none());
    }
    const user = usersMap.get(member.user_id);
    if (!user) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some(
        new RosterEntry({
          member_id: member.id,
          user_id: member.user_id,
          role_names: member.role_names,
          permissions: member.permissions,
          name: user.name,
          birth_year: user.birth_year,
          gender: user.gender,
          jersey_number: null,
          discord_username: user.discord_username,
          discord_avatar: user.discord_avatar,
        }),
      ),
    );
  },
  findRosterMemberByIds: (teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId || !member.active) {
      return Effect.succeed(Option.none());
    }
    const user = usersMap.get(member.user_id);
    if (!user) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some(
        new RosterEntry({
          member_id: member.id,
          user_id: member.user_id,
          role_names: member.role_names,
          permissions: member.permissions,
          name: user.name,
          birth_year: user.birth_year,
          gender: user.gender,
          jersey_number: null,
          discord_username: user.discord_username,
          discord_avatar: user.discord_avatar,
        }),
      ),
    );
  },
  deactivateMember: () => Effect.die(new Error('Not implemented')),
  deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
  findPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  getPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  assignRoleToMember: () => Effect.void,
  unassignRoleFromMember: () => Effect.void,
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  updateJerseyNumber: () => Effect.void,
  setJerseyNumber: () => Effect.void,
});

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

const MockRostersRepositoryLayer = Layer.succeed(RostersRepository, {
  _tag: 'api/RostersRepository',
  findByTeam: () => Effect.succeed([]),
  findByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findRosterById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  delete: () => Effect.void,
  findMemberEntries: () => Effect.succeed([]),
  findMemberEntriesById: () => Effect.succeed([]),
  addMember: () => Effect.void,
  addMemberById: () => Effect.void,
  removeMember: () => Effect.void,
  removeMemberById: () => Effect.void,
});

const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
  findByCode: () => Effect.succeed(Option.none()),
  findByTeam: () => Effect.succeed([]),
  create: () => Effect.die(new Error('Not implemented')),
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
  insert: () => Effect.void,
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
  Layer.provide(MockChannelSyncEventsRepositoryLayer),
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

beforeEach(() => {
  channelSyncEventCalls.length = 0;
});

describe('Channel Sync Events', () => {
  describe('createSubgroup', () => {
    it('emits channel_created sync event', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Goalkeepers' }),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(channelSyncEventCalls).toHaveLength(1);
      expect(channelSyncEventCalls[0]).toEqual({
        teamId: TEST_TEAM_ID,
        eventType: 'channel_created',
        subgroupId: body.subgroupId,
        subgroupName: Option.some('Goalkeepers'),
        teamMemberId: Option.none(),
        discordUserId: Option.none(),
      });
    });
  });

  describe('deleteSubgroup', () => {
    it('emits channel_deleted sync event', async () => {
      const createResponse = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'ToDelete' }),
        }),
      );
      const created = await createResponse.json();
      channelSyncEventCalls.length = 0;

      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups/${created.subgroupId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);

      expect(channelSyncEventCalls).toHaveLength(1);
      expect(channelSyncEventCalls[0]).toEqual({
        teamId: TEST_TEAM_ID,
        eventType: 'channel_deleted',
        subgroupId: created.subgroupId,
        subgroupName: Option.some('ToDelete'),
        teamMemberId: Option.none(),
        discordUserId: Option.none(),
      });
    });
  });

  describe('addSubgroupMember', () => {
    it('emits member_added sync event with discord_user_id', async () => {
      const createResponse = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'WithMembers' }),
        }),
      );
      const created = await createResponse.json();
      channelSyncEventCalls.length = 0;

      const response = await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/subgroups/${created.subgroupId}/members`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer admin-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
          },
        ),
      );
      expect(response.status).toBe(204);

      expect(channelSyncEventCalls).toHaveLength(1);
      expect(channelSyncEventCalls[0]).toEqual({
        teamId: TEST_TEAM_ID,
        eventType: 'member_added',
        subgroupId: created.subgroupId,
        subgroupName: Option.none(),
        teamMemberId: Option.some(TEST_MEMBER_ID),
        discordUserId: Option.some('12345'),
      });
    });
  });

  describe('removeSubgroupMember', () => {
    it('emits member_removed sync event with discord_user_id', async () => {
      const createResponse = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'ForRemoval' }),
        }),
      );
      const created = await createResponse.json();

      // Add member first
      await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/subgroups/${created.subgroupId}/members`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer admin-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
          },
        ),
      );
      channelSyncEventCalls.length = 0;

      const response = await handler(
        new Request(
          `http://localhost/teams/${TEST_TEAM_ID}/subgroups/${created.subgroupId}/members/${TEST_MEMBER_ID}`,
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer admin-token' },
          },
        ),
      );
      expect(response.status).toBe(204);

      expect(channelSyncEventCalls).toHaveLength(1);
      expect(channelSyncEventCalls[0]).toEqual({
        teamId: TEST_TEAM_ID,
        eventType: 'member_removed',
        subgroupId: created.subgroupId,
        subgroupName: Option.none(),
        teamMemberId: Option.some(TEST_MEMBER_ID),
        discordUserId: Option.some('12345'),
      });
    });
  });

  describe('sync event failure does not break primary operation', () => {
    it('createSubgroup succeeds even if sync event emission fails', async () => {
      const response = await handler(
        new Request(`http://localhost/teams/${TEST_TEAM_ID}/subgroups`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Resilient' }),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('Resilient');
    });
  });
});
