import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Discord, Role, Team, TeamMember, TrainingType } from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { RosterEntry, TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

// --- Test IDs ---
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const TEST_TT_1 = '00000000-0000-0000-0000-000000000050' as TrainingType.TrainingTypeId;
const TEST_TT_2 = '00000000-0000-0000-0000-000000000051' as TrainingType.TrainingTypeId;

const ADMIN_PERMISSIONS: readonly Role.Permission[] = [
  'team:manage',
  'team:invite',
  'roster:view',
  'roster:manage',
  'member:view',
  'member:edit',
  'member:remove',
  'role:view',
  'role:manage',
  'training-type:create',
  'training-type:delete',
];
const PLAYER_PERMISSIONS: readonly Role.Permission[] = ['roster:view', 'member:view'];

// --- Users ---
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
  guild_id: '999999999999999999' as Discord.Snowflake,
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

// --- Stores ---
const usersMap = new Map<Auth.UserId, UserLike>();
usersMap.set(TEST_USER_ID, testUser);
usersMap.set(TEST_ADMIN_ID, testAdmin);

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('user-token', TEST_USER_ID);
sessionsStore.set('admin-token', TEST_ADMIN_ID);

const membersStore = new Map<string, MembershipWithRole>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  role_names: ['Player'],
  permissions: PLAYER_PERMISSIONS,
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  active: true,
  role_names: ['Admin'],
  permissions: ADMIN_PERMISSIONS,
});

// --- In-memory training types ---
type TrainingTypeRecord = {
  id: TrainingType.TrainingTypeId;
  team_id: Team.TeamId;
  name: string;
  group_id: string | null;
  group_name: string | null;
  created_at: Date;
};

let trainingTypesStore: Map<TrainingType.TrainingTypeId, TrainingTypeRecord>;

const resetStores = () => {
  trainingTypesStore = new Map();
  trainingTypesStore.set(TEST_TT_1, {
    id: TEST_TT_1,
    team_id: TEST_TEAM_ID,
    name: 'Training Type 1',
    group_id: null,
    group_name: null,
    created_at: new Date(),
  });
  trainingTypesStore.set(TEST_TT_2, {
    id: TEST_TT_2,
    team_id: TEST_TEAM_ID,
    name: 'Training Type 2',
    group_id: null,
    group_name: null,
    created_at: new Date(),
  });
};

const buildRosterEntry = (
  memberId: TeamMember.TeamMemberId,
  userId: Auth.UserId,
  roleNames: readonly string[],
  permissions: readonly Role.Permission[],
): RosterEntry => {
  const user = usersMap.get(userId);
  if (!user) throw new Error(`User ${userId} not found in usersMap`);
  return new RosterEntry({
    member_id: memberId,
    user_id: userId,
    discord_id: user.discord_id,
    role_names: roleNames,
    permissions: permissions,
    name: user.name,
    birth_year: user.birth_year,
    gender: user.gender,
    jersey_number: null,
    discord_username: user.discord_username,
    discord_avatar: user.discord_avatar,
  });
};

// --- Mock layers ---
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
  getAccessToken: () => Effect.succeed('mock-access-token'),
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
  findByUser: (userId) =>
    Effect.succeed(Array.from(membersStore.values()).filter((m) => m.user_id === userId)),
  findRosterByTeam: (teamId) =>
    Effect.succeed(
      Array.from(membersStore.values())
        .filter((m) => m.team_id === teamId && m.active)
        .map((m) => buildRosterEntry(m.id, m.user_id, m.role_names, m.permissions)),
    ),
  findRosterMember: () => Effect.succeed(Option.none()),
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

const MockTrainingTypesRepositoryLayer = Layer.succeed(TrainingTypesRepository, {
  _tag: 'api/TrainingTypesRepository',
  findByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values())
      .filter((t) => t.team_id === teamId)
      .map((t) => ({
        id: t.id,
        team_id: t.team_id,
        name: t.name,
        group_id: t.group_id,
        group_name: t.group_name,
        created_at: t.created_at,
      }));
    return Effect.succeed(results);
  },
  findTrainingTypesByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values())
      .filter((t) => t.team_id === teamId)
      .map((t) => ({
        id: t.id,
        team_id: t.team_id,
        name: t.name,
        group_id: t.group_id,
        group_name: t.group_name,
        created_at: t.created_at,
      }));
    return Effect.succeed(results);
  },
  findById: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some({ id: tt.id, team_id: tt.team_id, name: tt.name, group_id: tt.group_id }),
    );
  },
  findTrainingTypeById: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some({ id: tt.id, team_id: tt.team_id, name: tt.name, group_id: tt.group_id }),
    );
  },
  findByIdWithGroup: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some(tt));
  },
  findTrainingTypeByIdWithGroup: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some(tt));
  },
  insert: (input: { team_id: string; name: string; group_id: string | null }) => {
    const id = crypto.randomUUID() as TrainingType.TrainingTypeId;
    const record: TrainingTypeRecord = {
      id,
      team_id: input.team_id as Team.TeamId,
      name: input.name,
      group_id: input.group_id,
      group_name: null,
      created_at: new Date(),
    };
    trainingTypesStore.set(id, record);
    return Effect.succeed({
      id,
      team_id: record.team_id,
      name: record.name,
      group_id: record.group_id,
    });
  },
  insertTrainingType: (teamId: Team.TeamId, name: string, groupId: string | null) => {
    const id = crypto.randomUUID() as TrainingType.TrainingTypeId;
    const record: TrainingTypeRecord = {
      id,
      team_id: teamId,
      name,
      group_id: groupId,
      group_name: null,
      created_at: new Date(),
    };
    trainingTypesStore.set(id, record);
    return Effect.succeed({ id, team_id: teamId, name, group_id: groupId });
  },
  update: (input: { id: TrainingType.TrainingTypeId; name: string }) => {
    const tt = trainingTypesStore.get(input.id);
    if (!tt) return Effect.die(new Error('Not found'));
    const updated = { ...tt, name: input.name };
    trainingTypesStore.set(input.id, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      name: updated.name,
      group_id: updated.group_id,
    });
  },
  updateTrainingType: (id: TrainingType.TrainingTypeId, name: string) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.die(new Error('Not found'));
    const updated = { ...tt, name };
    trainingTypesStore.set(id, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      name: updated.name,
      group_id: updated.group_id,
    });
  },
  deleteTrainingType: (id: TrainingType.TrainingTypeId) => {
    trainingTypesStore.delete(id);
    return Effect.void;
  },
  deleteTrainingTypeById: (id: TrainingType.TrainingTypeId) => {
    trainingTypesStore.delete(id);
    return Effect.void;
  },
} as unknown as TrainingTypesRepository);

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
  archiveRole: () => Effect.void,
  archiveRoleById: () => Effect.void,
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
  findGroupsForRoleId: () => Effect.succeed([]),
  findGroupsForRole: () => Effect.succeed([]),
  assignRoleGroup: () => Effect.void,
  assignRoleToGroup: () => Effect.void,
  unassignRoleGroup: () => Effect.void,
  unassignRoleFromGroup: () => Effect.void,
});

const MockGroupsRepositoryLayer = Layer.succeed(GroupsRepository, {
  _tag: 'api/GroupsRepository',
  findByTeamId: () => Effect.succeed([]),
  findGroupsByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findGroupById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertGroup: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateGroupById: () => Effect.die(new Error('Not implemented')),
  archiveGroup: () => Effect.void,
  archiveGroupById: () => Effect.void,
  moveGroupParent: () => Effect.die(new Error('Not implemented')),
  moveGroup: () => Effect.die(new Error('Not implemented')),
  findMembers: () => Effect.succeed([]),
  findMembersByGroupId: () => Effect.succeed([]),
  addMember: () => Effect.void,
  addMemberById: () => Effect.void,
  removeMember: () => Effect.void,
  removeMemberById: () => Effect.void,
  findRolesForGroup: () => Effect.succeed([]),
  getRolesForGroup: () => Effect.succeed([]),
  countMembersForGroup: () => Effect.succeed({ count: 0 }),
  getMemberCount: () => Effect.succeed(0),
  findChildren: () => Effect.succeed([]),
  getChildren: () => Effect.succeed([]),
  findAncestors: () => Effect.succeed([]),
  getAncestorIds: () => Effect.succeed([]),
  findDescendantMembers: () => Effect.succeed([]),
  getDescendantMemberIds: () => Effect.succeed([]),
});

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

const MockChannelSyncEventsRepositoryLayer = Layer.succeed(ChannelSyncEventsRepository, {
  emitIfGuildLinked: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as ChannelSyncEventsRepository);

const MockDiscordChannelMappingRepositoryLayer = Layer.succeed(DiscordChannelMappingRepository, {
  findByGroupId: () => Effect.succeed(Option.none()),
  insert: () => Effect.void,
  insertWithoutRole: () => Effect.void,
  deleteByGroupId: () => Effect.void,
} as unknown as DiscordChannelMappingRepository);

const MockDiscordChannelsRepositoryLayer = Layer.succeed(DiscordChannelsRepository, {
  syncChannels: () => Effect.void,
  findByGuildId: () => Effect.succeed([]),
} as unknown as DiscordChannelsRepository);

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  _tag: 'api/EventsRepository',
  findByTeamId: () => Effect.succeed([]),
  findEventsByTeamId: () => Effect.succeed([]),
  findByIdWithDetails: () => Effect.succeed(Option.none()),
  findEventByIdWithDetails: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertEvent: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateEvent: () => Effect.die(new Error('Not implemented')),
  cancel: () => Effect.void,
  cancelEvent: () => Effect.void,
  findScopedTrainingTypeIds: () => Effect.succeed([]),
  getScopedTrainingTypeIds: () => Effect.succeed([]),
} as unknown as EventsRepository);

const MockEventSeriesRepositoryLayer = Layer.succeed(EventSeriesRepository, {
  _tag: 'api/EventSeriesRepository',
  insertSeries: () => Effect.die(new Error('Not implemented')),
  insertEventSeries: () => Effect.die(new Error('Not implemented')),
  findByTeamId: () => Effect.succeed([]),
  findSeriesByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findSeriesById: () => Effect.succeed(Option.none()),
  updateSeries: () => Effect.die(new Error('Not implemented')),
  updateEventSeries: () => Effect.die(new Error('Not implemented')),
  cancelSeries: () => Effect.void,
  cancelEventSeries: () => Effect.void,
} as unknown as EventSeriesRepository);

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
  Layer.provide(MockGroupsRepositoryLayer),
  Layer.provide(MockTrainingTypesRepositoryLayer),
  Layer.provide(MockHttpClientLayer),
  Layer.provide(MockAgeCheckServiceLayer),
  Layer.provide(MockAgeThresholdRepositoryLayer),
  Layer.provide(MockNotificationsRepositoryLayer),
  Layer.provide(MockRoleSyncEventsRepositoryLayer),
  Layer.provide(MockChannelSyncEventsRepositoryLayer),
  Layer.provide(MockDiscordChannelMappingRepositoryLayer),
  Layer.provide(
    Layer.merge(
      Layer.merge(
        Layer.merge(
          Layer.merge(
            MockEventsRepositoryLayer,
            Layer.succeed(BotGuildsRepository, {
              upsert: () => Effect.void,
              remove: () => Effect.void,
              exists: () => Effect.succeed(false),
              findAll: () => Effect.succeed([]),
            } as unknown as BotGuildsRepository),
          ),
          MockDiscordChannelsRepositoryLayer,
        ),
        MockEventSeriesRepositoryLayer,
      ),
      Layer.succeed(TeamSettingsRepository, {
        _tag: 'api/TeamSettingsRepository',
        findByTeam: () => Effect.succeed(Option.none()),
        findByTeamId: () => Effect.succeed(Option.none()),
        upsertSettings: () => Effect.succeed({ team_id: 'test', event_horizon_days: 30 }),
        upsert: () => Effect.succeed({ team_id: 'test', event_horizon_days: 30 }),
        getHorizon: () => Effect.succeed({ event_horizon_days: 30 }),
        getHorizonDays: () => Effect.succeed(30),
      } as unknown as TeamSettingsRepository),
    ),
  ),
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
  resetStores();
});

const BASE = `http://localhost/teams/${TEST_TEAM_ID}/training-types`;

describe('Training Types API', () => {
  describe('GET /teams/:teamId/training-types (list)', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(BASE));
      expect(response.status).toBe(401);
    });

    it('returns 200 with all training types + canAdmin:true for admin', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer admin-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(true);
      expect(body.trainingTypes).toHaveLength(2);
    });

    it('returns 200 with all training types + canAdmin:false for regular member', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer user-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(false);
      expect(body.trainingTypes).toHaveLength(2);
    });
  });

  describe('GET /teams/:teamId/training-types/:trainingTypeId (get)', () => {
    it('returns 200 with canAdmin:true for admin viewing any training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_2}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(true);
      expect(body.trainingTypeId).toBe(TEST_TT_2);
    });

    it('returns 200 with canAdmin:false for regular member viewing any training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_1}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(false);
      expect(body.trainingTypeId).toBe(TEST_TT_1);
    });

    it('returns 404 for unknown training type', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`${BASE}/${unknownId}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /teams/:teamId/training-types/:trainingTypeId (update)', () => {
    it('returns 200 for admin updating training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_1}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Renamed' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Renamed');
    });

    it('returns 403 for regular member updating training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_1}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail' }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('POST /teams/:teamId/training-types (create)', () => {
    it('returns 201 for admin creating training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Type', groupId: null }),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('New Type');
    });

    it('returns 403 for regular member creating training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail', groupId: null }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /teams/:teamId/training-types/:trainingTypeId (delete)', () => {
    it('returns 204 for admin deleting training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_2}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });

    it('returns 403 for regular member deleting training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_1}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });
  });
});
