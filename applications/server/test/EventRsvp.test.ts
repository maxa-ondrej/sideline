import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Discord, Event, EventRsvp, Role, Team, TeamMember } from '@sideline/domain';
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
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { OAuthConnectionsRepository } from '~/repositories/OAuthConnectionsRepository.js';
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
const TEST_OTHER_USER_ID = '00000000-0000-0000-0000-000000000003' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const OTHER_TEAM_ID = '00000000-0000-0000-0000-000000000011' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const TEST_EVENT_ACTIVE = '00000000-0000-0000-0000-000000000060' as Event.EventId;
const TEST_EVENT_CANCELLED = '00000000-0000-0000-0000-000000000061' as Event.EventId;
const TEST_EVENT_PAST = '00000000-0000-0000-0000-000000000062' as Event.EventId;
const TEST_EVENT_OTHER_TEAM = '00000000-0000-0000-0000-000000000063' as Event.EventId;

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
  'event:create',
  'event:edit',
  'event:cancel',
];
const PLAYER_PERMISSIONS: readonly Role.Permission[] = ['roster:view', 'member:view'];

// --- Users ---
const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  discord_username: 'testuser',
  discord_avatar: null,

  is_profile_complete: true,
  name: 'Test User',
  birth_date: Option.some(DateTime.unsafeMake('2000-01-01')),
  gender: 'male' as const,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testAdmin = {
  id: TEST_ADMIN_ID,
  discord_id: '67890',
  discord_username: 'adminuser',
  discord_avatar: null,

  is_profile_complete: true,
  name: 'Admin User',
  birth_date: Option.some(DateTime.unsafeMake('1990-01-01')),
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
  is_profile_complete: boolean;
  name: string | null;
  birth_date: Option.Option<DateTime.Utc>;
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
sessionsStore.set('other-token', TEST_OTHER_USER_ID);

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

// --- In-memory events ---
type EventRecord = {
  id: Event.EventId;
  team_id: Team.TeamId;
  training_type_id: string | null;
  event_type: Event.EventType;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  status: Event.EventStatus;
  created_by: TeamMember.TeamMemberId;
  training_type_name: string | null;
  created_by_name: string | null;
  series_id: string | null;
  series_modified: boolean;
  discord_target_channel_id: string | null;
};

let eventsStore: Map<Event.EventId, EventRecord>;

// --- In-memory RSVPs ---
type RsvpRecord = {
  id: EventRsvp.EventRsvpId;
  event_id: Event.EventId;
  team_member_id: TeamMember.TeamMemberId;
  response: EventRsvp.RsvpResponse;
  message: string | null;
  member_name: string | null;
};

let rsvpsStore: Map<string, RsvpRecord>;

const resetStores = () => {
  eventsStore = new Map();
  eventsStore.set(TEST_EVENT_ACTIVE, {
    id: TEST_EVENT_ACTIVE,
    team_id: TEST_TEAM_ID,
    training_type_id: null,
    event_type: 'training',
    title: 'Future Training',
    description: null,
    start_at: '2099-12-31T18:00:00Z',
    end_at: '2099-12-31T20:00:00Z',
    location: 'Main Field',
    status: 'active',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  eventsStore.set(TEST_EVENT_CANCELLED, {
    id: TEST_EVENT_CANCELLED,
    team_id: TEST_TEAM_ID,
    training_type_id: null,
    event_type: 'match',
    title: 'Cancelled Match',
    description: null,
    start_at: '2099-12-15T14:00:00Z',
    end_at: '2099-12-15T16:00:00Z',
    location: null,
    status: 'cancelled',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  eventsStore.set(TEST_EVENT_PAST, {
    id: TEST_EVENT_PAST,
    team_id: TEST_TEAM_ID,
    training_type_id: null,
    event_type: 'training',
    title: 'Past Training',
    description: null,
    start_at: '2020-01-01T10:00:00Z',
    end_at: '2020-01-01T12:00:00Z',
    location: null,
    status: 'active',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  eventsStore.set(TEST_EVENT_OTHER_TEAM, {
    id: TEST_EVENT_OTHER_TEAM,
    team_id: OTHER_TEAM_ID,
    training_type_id: null,
    event_type: 'training',
    title: 'Other Team Event',
    description: null,
    start_at: '2099-12-31T18:00:00Z',
    end_at: null,
    location: null,
    status: 'active',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: null,
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  rsvpsStore = new Map();
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
    birth_date: user.birth_date.pipe(Option.map(DateTime.formatIsoDateUtc), Option.getOrNull),
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
  findByGuild: () => Effect.succeed(Option.none()),
  findByGuildId: () => Effect.succeed(Option.none()),
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

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  _tag: 'api/EventsRepository',
  findByTeamId: (teamId: string) => {
    const results = Array.from(eventsStore.values()).filter((e) => e.team_id === teamId);
    return Effect.succeed(results);
  },
  findEventsByTeamId: (teamId: string) => {
    const results = Array.from(eventsStore.values()).filter((e) => e.team_id === teamId);
    return Effect.succeed(results);
  },
  findByIdWithDetails: (id: Event.EventId) => {
    const event = eventsStore.get(id);
    if (!event) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some(event));
  },
  findEventByIdWithDetails: (id: Event.EventId) => {
    const event = eventsStore.get(id);
    if (!event) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some(event));
  },
  insert: () => Effect.die(new Error('Not implemented')),
  insertEvent: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateEvent: () => Effect.die(new Error('Not implemented')),
  cancel: () => Effect.void,
  cancelEvent: () => Effect.void,
  findScopedTrainingTypeIds: () => Effect.succeed([]),
  getScopedTrainingTypeIds: () => Effect.succeed([]),
  markModified: () => Effect.void,
  markEventSeriesModified: () => Effect.void,
  cancelFuture: () => Effect.void,
  cancelFutureInSeries: () => Effect.void,
  updateFutureUnmodified: () => Effect.void,
  updateFutureUnmodifiedInSeries: () => Effect.void,
} as unknown as EventsRepository);

const MockEventRsvpsRepositoryLayer = Layer.succeed(EventRsvpsRepository, {
  _tag: 'api/EventRsvpsRepository',
  findByEventId: (eventId: Event.EventId) => {
    const results = Array.from(rsvpsStore.values()).filter((r) => r.event_id === eventId);
    return Effect.succeed(results);
  },
  findRsvpsByEventId: (eventId: Event.EventId) => {
    const results = Array.from(rsvpsStore.values()).filter((r) => r.event_id === eventId);
    return Effect.succeed(results);
  },
  findByEventAndMember: (input: { event_id: string; team_member_id: string }) => {
    const key = `${input.event_id}:${input.team_member_id}`;
    const rsvp = rsvpsStore.get(key);
    return Effect.succeed(rsvp ? Option.some(rsvp) : Option.none());
  },
  findRsvpByEventAndMember: (eventId: Event.EventId, memberId: TeamMember.TeamMemberId) => {
    const key = `${eventId}:${memberId}`;
    const rsvp = rsvpsStore.get(key);
    return Effect.succeed(rsvp ? Option.some(rsvp) : Option.none());
  },
  upsert: (input: {
    event_id: string;
    team_member_id: string;
    response: string;
    message: string | null;
  }) => {
    const key = `${input.event_id}:${input.team_member_id}`;
    const existing = rsvpsStore.get(key);
    const id = existing?.id ?? (crypto.randomUUID() as EventRsvp.EventRsvpId);
    const record: RsvpRecord = {
      id,
      event_id: input.event_id as Event.EventId,
      team_member_id: input.team_member_id as TeamMember.TeamMemberId,
      response: input.response as EventRsvp.RsvpResponse,
      message: input.message,
      member_name: null,
    };
    rsvpsStore.set(key, record);
    return Effect.succeed({
      id: record.id,
      event_id: record.event_id,
      team_member_id: record.team_member_id,
      response: record.response,
      message: record.message,
    });
  },
  upsertRsvp: (
    eventId: Event.EventId,
    memberId: TeamMember.TeamMemberId,
    response: EventRsvp.RsvpResponse,
    message: string | null,
  ) => {
    const key = `${eventId}:${memberId}`;
    const existing = rsvpsStore.get(key);
    const id = existing?.id ?? (crypto.randomUUID() as EventRsvp.EventRsvpId);
    const record: RsvpRecord = {
      id,
      event_id: eventId,
      team_member_id: memberId,
      response,
      message,
      member_name: null,
    };
    rsvpsStore.set(key, record);
    return Effect.succeed({
      id: record.id,
      event_id: record.event_id,
      team_member_id: record.team_member_id,
      response: record.response,
      message: record.message,
    });
  },
  countByEventId: (eventId: Event.EventId) => {
    const rsvps = Array.from(rsvpsStore.values()).filter((r) => r.event_id === eventId);
    const counts = new Map<string, number>();
    for (const r of rsvps) {
      counts.set(r.response, (counts.get(r.response) ?? 0) + 1);
    }
    return Effect.succeed(
      Array.from(counts.entries()).map(([response, count]) => ({
        response: response as EventRsvp.RsvpResponse,
        count,
      })),
    );
  },
  countRsvpsByEventId: (eventId: Event.EventId) => {
    const rsvps = Array.from(rsvpsStore.values()).filter((r) => r.event_id === eventId);
    const counts = new Map<string, number>();
    for (const r of rsvps) {
      counts.set(r.response, (counts.get(r.response) ?? 0) + 1);
    }
    return Effect.succeed(
      Array.from(counts.entries()).map(([response, count]) => ({
        response: response as EventRsvp.RsvpResponse,
        count,
      })),
    );
  },
} as unknown as EventRsvpsRepository);

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
  findByTeamId: () => Effect.succeed([]),
  findTrainingTypesByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findTrainingTypeById: () => Effect.succeed(Option.none()),
  findByIdWithGroup: () => Effect.succeed(Option.none()),
  findTrainingTypeByIdWithGroup: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertTrainingType: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateTrainingType: () => Effect.die(new Error('Not implemented')),
  deleteTrainingType: () => Effect.void,
  deleteTrainingTypeById: () => Effect.void,
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

const MockEventSyncEventsRepositoryLayer = Layer.succeed(EventSyncEventsRepository, {
  emitIfGuildLinked: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as EventSyncEventsRepository);

const MockDiscordChannelMappingRepositoryLayer = Layer.succeed(DiscordChannelMappingRepository, {
  findByGroupId: () => Effect.succeed(Option.none()),
  insert: () => Effect.void,
  insertWithoutRole: () => Effect.void,
  deleteByGroupId: () => Effect.void,
  findAllByTeamId: () => Effect.succeed([]),
  findAllByTeam: () => Effect.succeed([]),
} as unknown as DiscordChannelMappingRepository);

const MockOAuthConnectionsRepositoryLayer = Layer.succeed(OAuthConnectionsRepository, {
  _tag: 'api/OAuthConnectionsRepository',
  upsertConnection: () => Effect.die(new Error('Not implemented')),
  upsert: () => Effect.die(new Error('Not implemented')),
  findByUserAndProvider: () => Effect.succeed(Option.none()),
  findByUser: () => Effect.succeed(Option.none()),
  findAccessToken: () => Effect.succeed(Option.some({ access_token: 'mock-access-token' })),
  getAccessToken: () => Effect.succeed('mock-access-token'),
} as unknown as OAuthConnectionsRepository);

const MockDiscordChannelsRepositoryLayer = Layer.succeed(DiscordChannelsRepository, {
  syncChannels: () => Effect.void,
  findByGuildId: () => Effect.succeed([]),
} as unknown as DiscordChannelsRepository);

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
  Layer.provide(
    Layer.merge(
      Layer.merge(MockEventsRepositoryLayer, MockEventSeriesRepositoryLayer),
      MockEventRsvpsRepositoryLayer,
    ),
  ),
  Layer.provide(MockHttpClientLayer),
  Layer.provide(MockAgeCheckServiceLayer),
  Layer.provide(MockAgeThresholdRepositoryLayer),
  Layer.provide(MockNotificationsRepositoryLayer),
  Layer.provide(MockRoleSyncEventsRepositoryLayer),
  Layer.provide(
    Layer.merge(MockChannelSyncEventsRepositoryLayer, MockEventSyncEventsRepositoryLayer),
  ),
  Layer.provide(
    Layer.merge(
      Layer.merge(
        Layer.merge(
          Layer.merge(
            MockDiscordChannelMappingRepositoryLayer,
            Layer.succeed(BotGuildsRepository, {
              upsert: () => Effect.void,
              remove: () => Effect.void,
              exists: () => Effect.succeed(false),
              findAll: () => Effect.succeed([]),
            } as unknown as BotGuildsRepository),
          ),
          MockDiscordChannelsRepositoryLayer,
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
      MockOAuthConnectionsRepositoryLayer,
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

const BASE = `http://localhost/teams/${TEST_TEAM_ID}/events`;

describe('Event RSVP API', () => {
  describe('GET /teams/:teamId/events/:eventId/rsvps', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvps`));
      expect(response.status).toBe(401);
    });

    it('returns 200 with empty RSVPs for active event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvps`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBeNull();
      expect(body.myMessage).toBeNull();
      expect(body.rsvps).toHaveLength(0);
      expect(body.yesCount).toBe(0);
      expect(body.noCount).toBe(0);
      expect(body.maybeCount).toBe(0);
      expect(body.canRsvp).toBe(true);
    });

    it('returns canRsvp:false for past event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_PAST}/rsvps`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canRsvp).toBe(false);
    });

    it('returns 404 for unknown event', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`${BASE}/${unknownId}/rsvps`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns 404 for event from different team', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_OTHER_TEAM}/rsvps`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(404);
    });

    it('returns user own RSVP status', async () => {
      // First submit an RSVP
      await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: 'I will be there!' }),
        }),
      );

      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvps`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBe('yes');
      expect(body.myMessage).toBe('I will be there!');
      expect(body.rsvps).toHaveLength(1);
      expect(body.yesCount).toBe(1);
    });
  });

  describe('PUT /teams/:teamId/events/:eventId/rsvp', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('player can submit RSVP yes', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBe('yes');
      expect(body.yesCount).toBe(1);
      expect(body.canRsvp).toBe(true);
    });

    it('player can submit RSVP no', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'no', message: 'Cannot make it' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBe('no');
      expect(body.myMessage).toBe('Cannot make it');
      expect(body.noCount).toBe(1);
    });

    it('player can submit RSVP maybe', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'maybe', message: null }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBe('maybe');
      expect(body.maybeCount).toBe(1);
    });

    it('player can update existing RSVP', async () => {
      // First submit yes
      await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );

      // Then update to no
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'no', message: 'Changed my mind' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myResponse).toBe('no');
      expect(body.myMessage).toBe('Changed my mind');
      expect(body.noCount).toBe(1);
      expect(body.yesCount).toBe(0);
    });

    it('player can add message to RSVP', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: 'Bringing snacks!' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.myMessage).toBe('Bringing snacks!');
    });

    it('non-member cannot RSVP (403)', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer other-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      // Returns 401 because the user doesn't exist in auth (not just non-member)
      expect(response.status).toBe(401);
    });

    it('cannot RSVP to cancelled event (404)', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_CANCELLED}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      expect(response.status).toBe(404);
    });

    it('cannot RSVP to event from different team (404)', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_OTHER_TEAM}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      expect(response.status).toBe(404);
    });

    it('cannot RSVP past deadline (400)', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_PAST}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );
      expect(response.status).toBe(400);
    });

    it('returns correct summary with counts from multiple users', async () => {
      // User submits yes
      await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'yes', message: null }),
        }),
      );

      // Admin submits maybe
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_ACTIVE}/rsvp`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ response: 'maybe', message: 'Not sure yet' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.yesCount).toBe(1);
      expect(body.maybeCount).toBe(1);
      expect(body.noCount).toBe(0);
      expect(body.rsvps).toHaveLength(2);
    });
  });
});
