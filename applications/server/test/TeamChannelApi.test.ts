/**
 * HTTP handler tests for the ChannelApi endpoints defined in
 * `applications/server/src/api/channel.ts`.
 *
 * Covers: listChannels, createChannel, archiveChannel, renameChannel, updateOrganization.
 * Uses the same mock-layer cascade as existing API handler tests.
 */

import type { Auth, Discord, Role, Team, TeamChannel, TeamMember } from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { HttpClient, HttpClientResponse, HttpRouter, HttpServer } from 'effect/unstable/http';
import { SqlClient } from 'effect/unstable/sql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AchievementRoleMappingsRepository } from '~/repositories/AchievementRoleMappingsRepository.js';
import { AchievementSettingsRepository } from '~/repositories/AchievementSettingsRepository.js';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { ActivityTypesRepository } from '~/repositories/ActivityTypesRepository.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { CustomAchievementsRepository } from '~/repositories/CustomAchievementsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';
import { DiscordRoleProvisionEventsRepository } from '~/repositories/DiscordRoleProvisionEventsRepository.js';
import { DiscordRolesRepository } from '~/repositories/DiscordRolesRepository.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { ICalTokensRepository } from '~/repositories/ICalTokensRepository.js';
import { InviteAcceptancesRepository } from '~/repositories/InviteAcceptancesRepository.js';
import { LeaderboardRepository } from '~/repositories/LeaderboardRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { OAuthConnectionsRepository } from '~/repositories/OAuthConnectionsRepository.js';
import { PendingGuildJoinsRepository } from '~/repositories/PendingGuildJoinsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { TeamChannelAccessRepository } from '~/repositories/TeamChannelAccessRepository.js';
import {
  ChannelNameAlreadyTakenError,
  TeamChannelsRepository,
} from '~/repositories/TeamChannelsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AchievementPreview } from '~/services/AchievementPreview.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { BotInfoStore } from '~/services/BotInfoStore.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';
import { MockDashboardLayoutsRepositoryLayer } from './mocks/dashboardLayoutMocks.js';
import { MockFinanceLayers } from './mocks/financeMocks.js';
import { MockTeamOnboardingTokensRepositoryLayer } from './mocks/onboardingMocks.js';
import { MockTeamChallengeRepositoryLayer } from './mocks/teamChallengeMocks.js';
import { MockTranslationsLayers } from './mocks/translationMocks.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-0000-0005-000000000001' as Auth.UserId;
const TEST_ADMIN_ID = '00000000-0000-0000-0005-000000000002' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0005-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0005-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0005-000000000021' as TeamMember.TeamMemberId;
const TEST_CHANNEL_ID = '00000000-0000-0000-0005-000000000030' as TeamChannel.TeamChannelId;
const TEST_GUILD_ID = '888888888888888888' as Discord.Snowflake;

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
  'group:manage',
];

// ---------------------------------------------------------------------------
// User + session fixtures
// ---------------------------------------------------------------------------

const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  username: 'testuser',
  avatar: Option.none<string>(),
  is_profile_complete: false,
  name: Option.none<string>(),
  birth_date: Option.none(),
  gender: Option.none<'male' | 'female' | 'other'>(),
  locale: 'en' as const,
  discord_display_name: Option.none<string>(),
  discord_nickname: Option.none<string>(),
  created_at: DateTime.nowUnsafe(),
  updated_at: DateTime.nowUnsafe(),
};

const testAdmin = {
  id: TEST_ADMIN_ID,
  discord_id: '67890',
  username: 'adminuser',
  avatar: Option.none<string>(),
  is_profile_complete: true,
  name: Option.some('Admin User'),
  birth_date: Option.some(DateTime.makeUnsafe('1990-01-01')),
  gender: Option.some('male' as const),
  locale: 'en' as const,
  discord_display_name: Option.none<string>(),
  discord_nickname: Option.none<string>(),
  created_at: DateTime.nowUnsafe(),
  updated_at: DateTime.nowUnsafe(),
};

const testTeam = {
  id: TEST_TEAM_ID,
  name: 'Test Team',
  guild_id: TEST_GUILD_ID,
  created_by: TEST_ADMIN_ID,
  created_at: DateTime.nowUnsafe(),
  updated_at: DateTime.nowUnsafe(),
};

const usersMap = new Map<Auth.UserId, typeof testUser | typeof testAdmin>();
usersMap.set(TEST_USER_ID, testUser);
usersMap.set(TEST_ADMIN_ID, testAdmin);

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('admin-token', TEST_ADMIN_ID);
sessionsStore.set('member-token', TEST_USER_ID);

const membersStore = new Map<string, MembershipWithRole>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  role_names: ['Player'],
  permissions: ['roster:view', 'member:view'],
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  active: true,
  role_names: ['Admin'],
  permissions: ADMIN_PERMISSIONS,
});

// ---------------------------------------------------------------------------
// Spy on managed channel sync events
// ---------------------------------------------------------------------------

type ManagedSyncCall =
  | {
      type: 'channel_created';
      teamChannelId: TeamChannel.TeamChannelId;
      discordChannelName: string;
    }
  | { type: 'channel_archived'; teamChannelId: TeamChannel.TeamChannelId }
  | { type: 'channel_deleted'; teamChannelId: TeamChannel.TeamChannelId }
  | { type: 'access_granted' }
  | { type: 'access_revoked' };

const managedSyncCalls: ManagedSyncCall[] = [];

const MockChannelSyncEventsRepositoryLayer = Layer.succeed(ChannelSyncEventsRepository, {
  _tag: 'api/ChannelSyncEventsRepository',
  emitChannelCreated: () => Effect.void,
  emitChannelDeleted: () => Effect.void,
  emitChannelArchived: () => Effect.void,
  emitChannelDetached: () => Effect.void,
  emitRosterChannelCreated: () => Effect.void,
  emitRosterChannelDeleted: () => Effect.void,
  emitRosterChannelArchived: () => Effect.void,
  emitRosterChannelDetached: () => Effect.void,
  emitGroupChannelUpdated: () => Effect.void,
  emitRosterChannelUpdated: () => Effect.void,
  emitMemberAdded: () => Effect.void,
  emitMemberRemoved: () => Effect.void,
  emitManagedChannelCreated: (args: {
    teamId: Team.TeamId;
    teamChannelId: TeamChannel.TeamChannelId;
    discordChannelName: string;
  }) => {
    managedSyncCalls.push({
      type: 'channel_created',
      teamChannelId: args.teamChannelId,
      discordChannelName: args.discordChannelName,
    });
    return Effect.void;
  },
  emitManagedChannelArchived: (args: { teamChannelId: TeamChannel.TeamChannelId }) => {
    managedSyncCalls.push({ type: 'channel_archived', teamChannelId: args.teamChannelId });
    return Effect.void;
  },
  emitManagedChannelDeleted: (args: { teamChannelId: TeamChannel.TeamChannelId }) => {
    managedSyncCalls.push({ type: 'channel_deleted', teamChannelId: args.teamChannelId });
    return Effect.void;
  },
  emitManagedAccessGrantedBatch: () => {
    managedSyncCalls.push({ type: 'access_granted' });
    return Effect.void;
  },
  emitManagedAccessRevokedBatch: () => {
    managedSyncCalls.push({ type: 'access_revoked' });
    return Effect.void;
  },
  emitMembersAddedBatch: () => Effect.void,
  emitMembersRemovedBatch: () => Effect.void,
  emitRosterMemberAdded: () => Effect.void,
  emitRosterMemberRemoved: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
  markPermanentlyFailed: () => Effect.void,
  hasUnprocessedForGroups: () => Effect.succeed([]),
  hasUnprocessedForRosters: () => Effect.succeed([]),
} as any);

// ---------------------------------------------------------------------------
// In-memory channels / access stores
// ---------------------------------------------------------------------------

let nextChannelId = 1;
const channelsStore = new Map<
  TeamChannel.TeamChannelId,
  {
    id: TeamChannel.TeamChannelId;
    team_id: Team.TeamId;
    name: string;
    category: Option.Option<string>;
    position: number;
    archived: boolean;
    discord_channel_id: Option.Option<Discord.Snowflake>;
    discord_role_id: Option.Option<Discord.Snowflake>;
  }
>();
const accessStore = new Map<string, { group_id: string; access_level: string }[]>();

const resetChannelStores = () => {
  channelsStore.clear();
  accessStore.clear();
  nextChannelId = 1;
};

const MockTeamChannelsRepositoryLayer = Layer.succeed(TeamChannelsRepository, {
  _tag: 'api/TeamChannelsRepository',
  findById: (channelId: TeamChannel.TeamChannelId) => {
    const ch = channelsStore.get(channelId);
    return Effect.succeed(ch ? Option.some(ch) : Option.none());
  },
  findAllByTeam: (teamId: Team.TeamId) =>
    Effect.succeed(Array.from(channelsStore.values()).filter((c) => c.team_id === teamId)),
  insert: (teamId: Team.TeamId, name: string, _category: Option.Option<string>) => {
    const id =
      `00000000-0000-0000-0005-${String(nextChannelId++).padStart(12, '0')}` as TeamChannel.TeamChannelId;
    const ch = {
      id,
      team_id: teamId,
      name,
      category: _category,
      position: 0,
      archived: false,
      discord_channel_id: Option.none<Discord.Snowflake>(),
      discord_role_id: Option.none<Discord.Snowflake>(),
    };
    channelsStore.set(id, ch);
    return Effect.succeed(ch);
  },
  rename: (channelId: TeamChannel.TeamChannelId, name: string) => {
    const ch = channelsStore.get(channelId);
    if (!ch) return Effect.die(new Error(`Channel ${channelId} not found`));
    const updated = { ...ch, name };
    channelsStore.set(channelId, updated);
    return Effect.succeed(updated);
  },
  updateOrganization: (
    channelId: TeamChannel.TeamChannelId,
    category: Option.Option<string>,
    position: number,
  ) => {
    const ch = channelsStore.get(channelId);
    if (!ch) return Effect.die(new Error(`Channel ${channelId} not found`));
    const updated = { ...ch, category, position };
    channelsStore.set(channelId, updated);
    return Effect.succeed(updated);
  },
  setArchived: (channelId: TeamChannel.TeamChannelId, archived: boolean) => {
    const ch = channelsStore.get(channelId);
    if (ch) channelsStore.set(channelId, { ...ch, archived });
    return Effect.void;
  },
  delete: (channelId: TeamChannel.TeamChannelId) => {
    channelsStore.delete(channelId);
    return Effect.void;
  },
  upsertDiscordChannelId: () => Effect.void,
  clearDiscordChannelId: (channelId: TeamChannel.TeamChannelId) => {
    const ch = channelsStore.get(channelId);
    if (ch) channelsStore.set(channelId, { ...ch, discord_channel_id: Option.none() });
    return Effect.void;
  },
} as never);

const MockTeamChannelAccessRepositoryLayer = Layer.succeed(TeamChannelAccessRepository, {
  _tag: 'api/TeamChannelAccessRepository',
  findByChannel: (channelId: TeamChannel.TeamChannelId) =>
    Effect.succeed(accessStore.get(channelId) ?? []),
  findByChannelForUpdate: (channelId: TeamChannel.TeamChannelId) =>
    Effect.succeed(accessStore.get(channelId) ?? []),
  upsertGrant: (channelId: TeamChannel.TeamChannelId, groupId: string, level: string) => {
    const current = accessStore.get(channelId) ?? [];
    const idx = current.findIndex((e) => e.group_id === groupId);
    if (idx >= 0) {
      current[idx] = { group_id: groupId, access_level: level };
    } else {
      current.push({ group_id: groupId, access_level: level });
    }
    accessStore.set(channelId, current);
    return Effect.void;
  },
  deleteGrant: (channelId: TeamChannel.TeamChannelId, groupId: string) => {
    const current = accessStore.get(channelId) ?? [];
    accessStore.set(
      channelId,
      current.filter((e) => e.group_id !== groupId),
    );
    return Effect.void;
  },
  countByChannel: (channelId: TeamChannel.TeamChannelId) =>
    Effect.succeed((accessStore.get(channelId) ?? []).length),
  findGroupRoleIds: () => Effect.succeed([]),
} as never);

// ---------------------------------------------------------------------------
// Standard mock cascade (copied from ChannelSync.test.ts pattern)
// ---------------------------------------------------------------------------

const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {
  createAuthorizationURL: () =>
    Effect.succeed(new URL('https://discord.com/oauth2/authorize?client_id=test')),
  validateAuthorizationCode: () =>
    Effect.succeed(
      new OAuth2Tokens({ access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' }),
    ),
} as any);

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  findById: (id: Auth.UserId) => Effect.succeed(Option.fromNullishOr(usersMap.get(id))),
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
  updateAdminProfile: () => Effect.die(new Error('Not implemented')),
} as any);

const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  create: () => Effect.die(new Error('Not implemented')),
  findByToken: (token: string) => {
    const userId = sessionsStore.get(token);
    if (!userId) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some({
        id: 'session-1',
        user_id: userId,
        token,
        expires_at: DateTime.nowUnsafe(),
        created_at: DateTime.nowUnsafe(),
      }),
    );
  },
  deleteByToken: () => Effect.void,
} as any);

const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  findById: (id: Team.TeamId) => {
    if (id === TEST_TEAM_ID) return Effect.succeed(Option.some(testTeam));
    return Effect.succeed(Option.none());
  },
  insert: () => Effect.succeed(testTeam),
  findByGuildId: () => Effect.succeed(Option.none()),
} as any);

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  addMember: () => Effect.die(new Error('Not implemented')),
  findMembershipByIds: (teamId: Team.TeamId, userId: Auth.UserId) => {
    const member = Array.from(membersStore.values()).find(
      (m) => m.team_id === teamId && m.user_id === userId,
    );
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
  findRosterByTeam: () => Effect.succeed([]),
  findRosterMemberByIds: () => Effect.succeed(Option.none()),
  deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
  getPlayerRoleId: () => Effect.succeed(Option.none()),
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  setJerseyNumber: () => Effect.void,
} as any);

const MockBotGuildsRepositoryLayer = Layer.succeed(BotGuildsRepository, {
  upsert: () => Effect.void,
  remove: () => Effect.void,
  exists: () => Effect.succeed(true), // guild IS linked by default
  findAll: () => Effect.succeed([]),
  findByGuildId: () => Effect.succeed(Option.none()),
} as any);

const MockTeamSettingsRepositoryLayer = Layer.succeed(TeamSettingsRepository, {
  findByTeam: () => Effect.succeed(Option.none()),
  findByTeamId: () =>
    Effect.succeed(
      Option.some({
        team_id: TEST_TEAM_ID,
        event_horizon_days: 30,
        discord_archive_category_id: Option.some('777777777777777777' as Discord.Snowflake),
      }),
    ),
  upsertSettings: () => Effect.void,
  upsert: () => Effect.void,
  getHorizon: () => Effect.succeed({ event_horizon_days: 30 }),
  getHorizonDays: () => Effect.succeed(30),
} as any);

// SqlClient mock — needed for archiveChannel which uses sql.withTransaction
const MockSqlClientLayer = Layer.succeed(
  SqlClient.SqlClient,
  Object.assign(
    function mockSql(_strings: TemplateStringsArray, ..._args: unknown[]) {
      return Effect.succeed([] as never[]);
    },
    {
      safe: undefined as any,
      withoutTransforms: function (this: any) {
        return this;
      },
      reserve: Effect.die(new Error('reserve not implemented')),
      withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | any, R> =>
        effect,
      reactive: () => Effect.succeed([] as never[]),
      reactiveMailbox: () => Effect.die(new Error('reactiveMailbox not implemented')),
      unsafe: (_sql: string, _params?: ReadonlyArray<unknown>) => Effect.succeed([] as never[]),
      literal: (_sql: string) => ({ _tag: 'Fragment' as const, segments: [] }),
      in: (..._args: unknown[]) => Effect.succeed([] as never[]),
      insert: (..._args: unknown[]) => Effect.succeed([] as never[]),
      update: (..._args: unknown[]) => Effect.succeed([] as never[]),
      updateValues: (..._args: unknown[]) => Effect.succeed([] as never[]),
      and: (..._args: unknown[]) => Effect.succeed([] as never[]),
      or: (..._args: unknown[]) => Effect.succeed([] as never[]),
      join:
        (..._args: unknown[]) =>
        (_arr: unknown[]) =>
          Effect.succeed([] as never[]),
    },
  ) as unknown as SqlClient.SqlClient,
);

const buildLayer = (overrides?: {
  botGuildsLayer?: Layer.Layer<BotGuildsRepository>;
  channelSyncLayer?: Layer.Layer<ChannelSyncEventsRepository>;
  teamSettingsLayer?: Layer.Layer<TeamSettingsRepository>;
  channelsLayer?: Layer.Layer<TeamChannelsRepository>;
}) =>
  ApiLive.pipe(
    Layer.provideMerge(AuthMiddlewareLive),
    Layer.provideMerge(HttpServer.layerServices),
    Layer.provide(MockDiscordOAuthLayer),
    Layer.provide(MockUsersRepositoryLayer),
    Layer.provide(MockSessionsRepositoryLayer),
    Layer.provide(MockTeamsRepositoryLayer),
    Layer.provide(MockTeamMembersRepositoryLayer),
    Layer.provide(
      Layer.merge(
        Layer.merge(
          Layer.succeed(RostersRepository, {
            findByTeamId: () => Effect.succeed([]),
            findRosterById: () => Effect.succeed(Option.none()),
            insert: () => Effect.die(new Error('Not implemented')),
            update: () => Effect.die(new Error('Not implemented')),
            delete: () => Effect.void,
            findMemberEntriesById: () => Effect.succeed([]),
            addMemberById: () => Effect.void,
            removeMemberById: () => Effect.void,
          } as any),
          Layer.succeed(ActivityLogsRepository, {
            insert: () => Effect.die(new Error('not implemented')),
            findByTeamMember: () => Effect.succeed([]),
          } as any),
        ),
        Layer.merge(
          Layer.succeed(ActivityTypesRepository, {
            findBySlug: () => Effect.succeed(Option.none()),
            findByTeamId: () => Effect.succeed([]),
            findById: () => Effect.succeed(Option.none()),
          } as any),
          Layer.succeed(LeaderboardRepository, {
            getLeaderboard: () => Effect.succeed([]),
          } as any),
        ),
      ),
    ),
    Layer.provide(
      Layer.merge(
        Layer.succeed(TeamInvitesRepository, {
          findByCode: () => Effect.succeed(Option.none()),
          findByTeam: () => Effect.succeed([]),
          create: () => Effect.die(new Error('Not implemented')),
          deactivateByTeam: () => Effect.void,
          deactivateByTeamExcept: () => Effect.void,
        } as any),
        Layer.merge(
          Layer.succeed(PendingGuildJoinsRepository, {
            enqueue: () => Effect.void,
            listPending: () => Effect.succeed([]),
            markDone: () => Effect.void,
            markFailed: () => Effect.void,
          } as never),
          Layer.succeed(InviteAcceptancesRepository, {} as never),
        ),
      ),
    ),
    Layer.provide(
      Layer.succeed(RolesRepository, {
        findRolesByTeamId: () => Effect.succeed([]),
        findRoleById: () => Effect.succeed(Option.none()),
        getPermissionsForRoleId: () => Effect.succeed([]),
        insertRole: () => Effect.die(new Error('Not implemented')),
        updateRole: () => Effect.die(new Error('Not implemented')),
        archiveRoleById: () => Effect.void,
        setRolePermissions: () => Effect.void,
        initializeTeamRoles: () => Effect.void,
        findRoleByTeamAndName: () => Effect.succeed(Option.none()),
        seedTeamRolesWithPermissions: () => Effect.succeed([]),
        getMemberCountForRole: () => Effect.succeed(0),
        findGroupsForRole: () => Effect.succeed([]),
        assignRoleToGroup: () => Effect.void,
        unassignRoleFromGroup: () => Effect.void,
      } as any),
    ),
    Layer.provide(
      Layer.succeed(GroupsRepository, {
        findGroupsByTeamId: () => Effect.succeed([]),
        findGroupById: () => Effect.succeed(Option.none()),
        insertGroup: () => Effect.die(new Error('Not implemented')),
        updateGroupById: () => Effect.die(new Error('Not implemented')),
        archiveGroupById: () => Effect.void,
        moveGroup: () => Effect.die(new Error('Not implemented')),
        findMembersByGroupId: () => Effect.succeed([]),
        addMemberById: () => Effect.void,
        removeMemberById: () => Effect.void,
        getRolesForGroup: () => Effect.succeed([]),
        getMemberCount: () => Effect.succeed(0),
        getChildren: () => Effect.succeed([]),
        getAncestorIds: () => Effect.succeed([]),
        getAncestors: () => Effect.succeed([]),
        getDescendantMemberIds: () => Effect.succeed([]),
      } as any),
    ),
    Layer.provide(
      Layer.succeed(TrainingTypesRepository, {
        findByTeamId: () => Effect.succeed([]),
        findById: () => Effect.succeed(Option.none()),
        insert: () => Effect.die(new Error('Not implemented')),
        update: () => Effect.die(new Error('Not implemented')),
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
      } as any),
    ),
    Layer.provide(
      Layer.succeed(
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
      ),
    ),
    Layer.provide(
      Layer.succeed(AgeCheckService, {
        evaluateTeam: () => Effect.succeed([]),
        evaluate: () => Effect.succeed([]),
      } as any),
    ),
    Layer.provide(
      Layer.succeed(AgeThresholdRepository, {
        findByTeamId: () => Effect.succeed([]),
        findById: () => Effect.succeed(Option.none()),
        insert: () => Effect.die(new Error('Not implemented')),
        updateRuleById: () => Effect.die(new Error('Not implemented')),
        deleteRuleById: () => Effect.void,
        getAllTeamsWithRules: () => Effect.succeed([]),
        getMembersForAutoAssignment: () => Effect.succeed([]),
        findRulesByTeamId: () => Effect.succeed([]),
        findRuleById: () => Effect.succeed(Option.none()),
      } as any),
    ),
    Layer.provide(
      Layer.merge(
        Layer.succeed(NotificationsRepository, {
          findByUser: () => Effect.succeed([]),
          insert: () => Effect.void,
          insertBulk: () => Effect.void,
          markAsRead: () => Effect.void,
          markAllAsRead: () => Effect.void,
          findById: () => Effect.succeed(Option.none()),
        } as any),
        Layer.succeed(RoleSyncEventsRepository, {
          emitRoleCreated: () => Effect.void,
          emitRoleDeleted: () => Effect.void,
          emitRoleAssigned: () => Effect.void,
          emitRoleUnassigned: () => Effect.void,
          findUnprocessed: () => Effect.succeed([]),
          markProcessed: () => Effect.void,
          markFailed: () => Effect.void,
        } as any),
      ),
    ),
    Layer.provide(
      Layer.merge(
        overrides?.channelSyncLayer ?? MockChannelSyncEventsRepositoryLayer,
        Layer.succeed(EventSyncEventsRepository, {
          emitEventCreated: () => Effect.void,
          emitEventUpdated: () => Effect.void,
          emitEventCancelled: () => Effect.void,
          emitRsvpReminder: () => Effect.void,
          findUnprocessed: () => Effect.succeed([]),
          markProcessed: () => Effect.void,
          markFailed: () => Effect.void,
        } as any),
      ),
    ),
    Layer.provide(
      Layer.merge(
        Layer.succeed(DiscordChannelMappingRepository, {
          findByGroupId: () => Effect.succeed(Option.none()),
          findByRosterId: () => Effect.succeed(Option.none()),
          insert: () => Effect.void,
          insertRoleOnly: () => Effect.void,
          upsertGroupChannel: () => Effect.void,
          clearGroupChannel: () => Effect.void,
          insertRoster: () => Effect.void,
          deleteByGroupId: () => Effect.void,
          deleteByRosterId: () => Effect.void,
          findAllByTeam: () => Effect.succeed([]),
        } as any),
        Layer.succeed(ICalTokensRepository, {
          findByToken: () => Effect.succeed(Option.none()),
          findByUserId: () => Effect.succeed(Option.none()),
          create: () =>
            Effect.succeed({
              id: 'ical-id',
              user_id: 'user-id',
              token: 'ical-token',
              created_at: new Date(),
            }),
          regenerate: () =>
            Effect.succeed({
              id: 'ical-id',
              user_id: 'user-id',
              token: 'ical-token-new',
              created_at: new Date(),
            }),
        } as any),
      ),
    ),
    Layer.provide(
      Layer.merge(
        Layer.merge(
          Layer.merge(
            Layer.merge(
              Layer.merge(
                Layer.merge(
                  Layer.succeed(EventsRepository, {
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
                  } as any),
                  Layer.succeed(EventRsvpsRepository, {
                    findByEventId: () => Effect.succeed([]),
                    findByEventAndMember: () => Effect.succeed(Option.none()),
                    upsert: () => Effect.die(new Error('Not implemented')),
                    countByEventId: () => Effect.succeed([]),
                  } as any),
                ),
                overrides?.botGuildsLayer ?? MockBotGuildsRepositoryLayer,
              ),
              Layer.merge(
                Layer.succeed(DiscordChannelsRepository, {
                  syncChannels: () => Effect.void,
                  findByGuildId: () => Effect.succeed([]),
                } as any),
                Layer.succeed(
                  DiscordRolesRepository,
                  new Proxy({} as any, { get: () => () => Effect.void }),
                ),
              ),
            ),
            Layer.succeed(EventSeriesRepository, {
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
            } as any),
          ),
          overrides?.teamSettingsLayer ?? MockTeamSettingsRepositoryLayer,
        ),
        Layer.succeed(OAuthConnectionsRepository, {
          upsert: () => Effect.die(new Error('Not implemented')),
          findByUserAndProvider: () => Effect.succeed(Option.none()),
          findByUser: () => Effect.succeed(Option.none()),
          findAccessToken: () => Effect.succeed(Option.some({ access_token: 'mock-access-token' })),
          getAccessToken: () => Effect.succeed('mock-access-token'),
        } as any),
      ),
    ),
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AchievementRoleMappingsRepository, {
          findAllByTeam: () => Effect.succeed([]),
          upsert: () => Effect.void,
          delete: () => Effect.void,
        } as any),
        Layer.succeed(AchievementSettingsRepository, {
          findOverridesByTeam: () => Effect.succeed(new Map()),
          upsertOverride: () => Effect.void,
          deleteOverride: () => Effect.void,
        } as any),
        Layer.succeed(CustomAchievementsRepository, {
          findByTeam: () => Effect.succeed([]),
          findById: () => Effect.succeed(Option.none()),
          insert: () => Effect.die(new Error('Not implemented')),
          update: () => Effect.die(new Error('Not implemented')),
          delete: () => Effect.void,
          setRoleMapping: () => Effect.void,
        } as any),
        Layer.succeed(DiscordRoleProvisionEventsRepository, {
          enqueue: () => Effect.void,
          findUnprocessed: () => Effect.succeed([]),
          markProcessed: () => Effect.void,
          markFailed: () => Effect.void,
        } as any),
        Layer.succeed(AchievementPreview, {
          preview: () =>
            Effect.succeed({ qualifyingCount: 0, removedMembers: [], botCanManageRoles: true }),
        } as any),
      ),
    ),
  )
    .pipe(Layer.provide(MockFinanceLayers))
    .pipe(Layer.provide(MockTranslationsLayers))
    .pipe(Layer.provide(MockTeamOnboardingTokensRepositoryLayer))
    .pipe(Layer.provide(MockTeamChallengeRepositoryLayer))
    .pipe(Layer.provide(MockDashboardLayoutsRepositoryLayer))
    .pipe(Layer.provide(overrides?.channelsLayer ?? MockTeamChannelsRepositoryLayer))
    .pipe(Layer.provide(MockTeamChannelAccessRepositoryLayer))
    .pipe(Layer.provide(MockSqlClientLayer))
    .pipe(Layer.provide(BotInfoStore.Default));

let handler: (...args: any) => Promise<Response>;
let dispose: () => Promise<void>;

beforeAll(() => {
  const app = HttpRouter.toWebHandler(buildLayer());
  handler = app.handler;
  dispose = app.dispose;
});

afterAll(async () => {
  await dispose();
});

beforeEach(() => {
  resetChannelStores();
  managedSyncCalls.length = 0;
});

// ---------------------------------------------------------------------------
// listChannels
// ---------------------------------------------------------------------------

describe('listChannels', () => {
  it('returns canManage=true and guildLinked=true for admin', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.canManage).toBe(true);
    expect(body.guildLinked).toBe(true);
    expect(Array.isArray(body.channels)).toBe(true);
  });

  it('returns canManage=false for member without group:manage', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        headers: { Authorization: 'Bearer member-token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.canManage).toBe(false);
  });

  it('includes accessCount per channel', async () => {
    // Pre-seed a channel
    const id = '00000000-0000-0000-0005-seed000000001' as TeamChannel.TeamChannelId;
    channelsStore.set(id, {
      id,
      team_id: TEST_TEAM_ID,
      name: 'announcements',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });
    accessStore.set(id, [
      { group_id: 'g1', access_level: 'VIEW' },
      { group_id: 'g2', access_level: 'EDIT' },
    ]);

    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const ch = body.channels.find((c: any) => c.channelId === id);
    expect(ch).toBeDefined();
    expect(ch.accessCount).toBe(2);
  });

  it('returns 401 or 403 for unauthenticated request', async () => {
    const response = await handler(new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`));
    // Unauthenticated requests get a 401 from AuthMiddleware
    expect([401, 403]).toContain(response.status);
  });
});

// ---------------------------------------------------------------------------
// createChannel
// ---------------------------------------------------------------------------

describe('createChannel', () => {
  it('creates channel and returns 201 with channel detail', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'announcements', category: null }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('announcements');
    expect(body.channelId).toBeDefined();
  });

  it('emits managed_channel_created sync event after insert', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'general', category: null }),
      }),
    );

    expect(response.status).toBe(201);
    const created = managedSyncCalls.filter((c) => c.type === 'channel_created');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ type: 'channel_created', discordChannelName: 'general' });
  });

  it('returns 409 when channel name already taken', async () => {
    // First create succeeds
    await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate', category: null }),
      }),
    );

    // Simulate unique violation by using the mock that throws ChannelNameAlreadyTakenError
    // We need a separate layer for this; we test the mock response shape instead
    // The real uniqueness is tested via integration tests. Here we verify the 409 status
    // by using a mock layer that returns the error.
    const dupChannelSyncLayer = Layer.succeed(ChannelSyncEventsRepository, {
      ...({} as any),
      emitManagedChannelCreated: () => Effect.void,
      findUnprocessed: () => Effect.succeed([]),
      markProcessed: () => Effect.void,
      markFailed: () => Effect.void,
      markPermanentlyFailed: () => Effect.void,
      hasUnprocessedForGroups: () => Effect.succeed([]),
      hasUnprocessedForRosters: () => Effect.succeed([]),
    } as any);

    // Test that the error class maps to 409 by checking the API definition
    // ChannelNameAlreadyTaken is defined with status(409) in ChannelApi
    // We verify behavior by manually testing with a mock that throws
    const dupChannelsLayer = Layer.succeed(TeamChannelsRepository, {
      _tag: 'api/TeamChannelsRepository',
      findById: () => Effect.succeed(Option.none()),
      findAllByTeam: () => Effect.succeed([]),
      insert: () => Effect.fail(new ChannelNameAlreadyTakenError()),
      rename: () => Effect.die(new Error('Not implemented')),
      updateOrganization: () => Effect.die(new Error('Not implemented')),
      setArchived: () => Effect.void,
      delete: () => Effect.void,
      upsertDiscordChannelId: () => Effect.void,
      clearDiscordChannelId: () => Effect.void,
    } as never);

    const dupApp = HttpRouter.toWebHandler(
      buildLayer({ channelSyncLayer: dupChannelSyncLayer, channelsLayer: dupChannelsLayer }),
    );
    const dupHandler: (...args: any) => Promise<Response> = dupApp.handler;
    const dupResponse = await dupHandler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate', category: null }),
      }),
    );
    await dupApp.dispose();

    expect(dupResponse.status).toBe(409);
  });

  it('returns 403 for member without group:manage', async () => {
    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels`, {
        method: 'POST',
        headers: { Authorization: 'Bearer member-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'general', category: null }),
      }),
    );

    expect(response.status).toBe(403);
    expect(managedSyncCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// archiveChannel
// ---------------------------------------------------------------------------

describe('archiveChannel', () => {
  it('archives channel and emits managed_channel_archived when archive category exists', async () => {
    // Pre-seed a channel with a discord_channel_id
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-channel',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.some('555555555555555555' as Discord.Snowflake),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/archive`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );

    expect(response.status).toBe(204);

    // Channel should be archived
    const ch = channelsStore.get(TEST_CHANNEL_ID);
    expect(ch?.archived).toBe(true);

    // Sync event should be emitted
    const archivedCalls = managedSyncCalls.filter((c) => c.type === 'channel_archived');
    expect(archivedCalls).toHaveLength(1);
  });

  it('archives channel but does NOT emit sync event when no archive category in settings', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-channel',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.some('555555555555555555' as Discord.Snowflake),
      discord_role_id: Option.none(),
    });

    const noArchiveCategoryLayer = Layer.succeed(TeamSettingsRepository, {
      findByTeam: () => Effect.succeed(Option.none()),
      findByTeamId: () =>
        Effect.succeed(
          Option.some({
            team_id: TEST_TEAM_ID,
            event_horizon_days: 30,
            discord_archive_category_id: Option.none(),
          }),
        ),
      upsertSettings: () => Effect.void,
      upsert: () => Effect.void,
      getHorizon: () => Effect.succeed({ event_horizon_days: 30 }),
      getHorizonDays: () => Effect.succeed(30),
    } as any);

    const customApp = HttpRouter.toWebHandler(
      buildLayer({ teamSettingsLayer: noArchiveCategoryLayer }),
    );
    const customHandler: (...args: any) => Promise<Response> = customApp.handler;

    const response = await customHandler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/archive`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    await customApp.dispose();

    expect(response.status).toBe(204);
    const archivedCalls = managedSyncCalls.filter((c) => c.type === 'channel_archived');
    expect(archivedCalls).toHaveLength(0);
  });

  it('returns 403 for member without group:manage', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-channel',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/archive`, {
        method: 'POST',
        headers: { Authorization: 'Bearer member-token' },
      }),
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// renameChannel
// ---------------------------------------------------------------------------

describe('renameChannel', () => {
  it('renames channel and returns updated detail', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-name',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/name`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'new-name' }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('new-name');
  });

  it('does NOT emit any managed sync event (v1 decision)', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-name',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/name`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    );

    expect(managedSyncCalls).toHaveLength(0);
  });

  it('returns 403 for member without group:manage', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'old-name',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(`http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/name`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer member-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'hacked' }),
      }),
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// updateOrganization
// ---------------------------------------------------------------------------

describe('updateOrganization', () => {
  it('updates category and position, no sync event emitted', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'channel',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(
        `http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/organization`,
        {
          method: 'PATCH',
          headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'Section A', position: 5 }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.position).toBe(5);
    // No sync events for organization changes
    expect(managedSyncCalls).toHaveLength(0);
  });

  it('returns 403 for member without group:manage', async () => {
    channelsStore.set(TEST_CHANNEL_ID, {
      id: TEST_CHANNEL_ID,
      team_id: TEST_TEAM_ID,
      name: 'channel',
      category: Option.none(),
      position: 0,
      archived: false,
      discord_channel_id: Option.none(),
      discord_role_id: Option.none(),
    });

    const response = await handler(
      new Request(
        `http://localhost/teams/${TEST_TEAM_ID}/channels/${TEST_CHANNEL_ID}/organization`,
        {
          method: 'PATCH',
          headers: { Authorization: 'Bearer member-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: null, position: 0 }),
        },
      ),
    );

    expect(response.status).toBe(403);
  });
});
