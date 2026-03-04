import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Discord, Event, Role, Team, TeamMember, TrainingType } from '@sideline/domain';
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
const TEST_CAPTAIN_ID = '00000000-0000-0000-0000-000000000003' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_CAPTAIN_MEMBER_ID = '00000000-0000-0000-0000-000000000022' as TeamMember.TeamMemberId;
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const TEST_EVENT_1 = '00000000-0000-0000-0000-000000000060' as Event.EventId;
const TEST_EVENT_2 = '00000000-0000-0000-0000-000000000061' as Event.EventId;
const TEST_EVENT_SCOPED = '00000000-0000-0000-0000-000000000062' as Event.EventId;
const TEST_TRAINING_TYPE_A = '00000000-0000-0000-0000-000000000050' as TrainingType.TrainingTypeId;
const TEST_TRAINING_TYPE_B = '00000000-0000-0000-0000-000000000051' as TrainingType.TrainingTypeId;

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
const CAPTAIN_PERMISSIONS: readonly Role.Permission[] = [
  'roster:view',
  'roster:manage',
  'member:view',
  'member:edit',
  'role:view',
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
  discord_access_token: 'token',
  discord_refresh_token: null,
  is_profile_complete: false,
  name: null,
  birth_date: Option.none(),
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
  birth_date: Option.some(DateTime.unsafeMake('1990-01-01')),
  gender: 'male' as const,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testCaptain = {
  id: TEST_CAPTAIN_ID,
  discord_id: '11111',
  discord_username: 'captainuser',
  discord_avatar: null,
  discord_access_token: 'captain-token',
  discord_refresh_token: null,
  is_profile_complete: true,
  name: 'Captain User',
  birth_date: Option.some(DateTime.unsafeMake('1992-01-01')),
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
usersMap.set(TEST_CAPTAIN_ID, testCaptain);

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('user-token', TEST_USER_ID);
sessionsStore.set('admin-token', TEST_ADMIN_ID);
sessionsStore.set('captain-token', TEST_CAPTAIN_ID);

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
membersStore.set(TEST_CAPTAIN_MEMBER_ID, {
  id: TEST_CAPTAIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_CAPTAIN_ID,
  active: true,
  role_names: ['Captain'],
  permissions: CAPTAIN_PERMISSIONS,
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

const resetStores = () => {
  eventsStore = new Map();
  eventsStore.set(TEST_EVENT_1, {
    id: TEST_EVENT_1,
    team_id: TEST_TEAM_ID,
    training_type_id: null,
    event_type: 'training',
    title: 'Tuesday Training',
    description: 'Weekly training session',
    start_at: '2026-03-10T18:00:00Z',
    end_at: '2026-03-10T20:00:00Z',
    location: 'Main Field',
    status: 'active',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  eventsStore.set(TEST_EVENT_2, {
    id: TEST_EVENT_2,
    team_id: TEST_TEAM_ID,
    training_type_id: null,
    event_type: 'match',
    title: 'Cancelled Match',
    description: null,
    start_at: '2026-03-15T14:00:00Z',
    end_at: '2026-03-15T16:00:00Z',
    location: null,
    status: 'cancelled',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: null,
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
  });
  eventsStore.set(TEST_EVENT_SCOPED, {
    id: TEST_EVENT_SCOPED,
    team_id: TEST_TEAM_ID,
    training_type_id: TEST_TRAINING_TYPE_A,
    event_type: 'training',
    title: 'Scoped Training',
    description: null,
    start_at: '2026-03-12T17:00:00Z',
    end_at: '2026-03-12T19:00:00Z',
    location: null,
    status: 'active',
    created_by: TEST_ADMIN_MEMBER_ID,
    training_type_name: 'Type A',
    created_by_name: 'Admin User',
    series_id: null,
    series_modified: false,
    discord_target_channel_id: null,
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
  insert: (input: {
    team_id: string;
    training_type_id: string | null;
    event_type: string;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    location: string | null;
    created_by: string;
    series_id: string | null;
  }) => {
    const id = crypto.randomUUID() as Event.EventId;
    const record: EventRecord = {
      id,
      team_id: input.team_id as Team.TeamId,
      training_type_id: input.training_type_id,
      event_type: input.event_type as Event.EventType,
      title: input.title,
      description: input.description,
      start_at: input.start_at,
      end_at: input.end_at,
      location: input.location,
      status: 'active',
      created_by: input.created_by as TeamMember.TeamMemberId,
      training_type_name: null,
      created_by_name: null,
      series_id: input.series_id,
      series_modified: false,
      discord_target_channel_id: null,
    };
    eventsStore.set(id, record);
    return Effect.succeed({
      id,
      team_id: record.team_id,
      training_type_id: record.training_type_id,
      event_type: record.event_type,
      title: record.title,
      description: record.description,
      start_at: record.start_at,
      end_at: record.end_at,
      location: record.location,
      status: record.status,
      created_by: record.created_by,
      series_id: record.series_id,
      series_modified: record.series_modified,
      discord_target_channel_id: null,
    });
  },
  insertEvent: (input: {
    teamId: string;
    trainingTypeId: string | null;
    eventType: string;
    title: string;
    description: string | null;
    startAt: string;
    endAt: string | null;
    location: string | null;
    createdBy: string;
    seriesId?: string | null;
  }) => {
    const id = crypto.randomUUID() as Event.EventId;
    const record: EventRecord = {
      id,
      team_id: input.teamId as Team.TeamId,
      training_type_id: input.trainingTypeId,
      event_type: input.eventType as Event.EventType,
      title: input.title,
      description: input.description,
      start_at: input.startAt,
      end_at: input.endAt,
      location: input.location,
      status: 'active',
      created_by: input.createdBy as TeamMember.TeamMemberId,
      training_type_name: null,
      created_by_name: null,
      series_id: input.seriesId ?? null,
      series_modified: false,
      discord_target_channel_id: null,
    };
    eventsStore.set(id, record);
    return Effect.succeed({
      id,
      team_id: record.team_id,
      training_type_id: record.training_type_id,
      event_type: record.event_type,
      title: record.title,
      description: record.description,
      start_at: record.start_at,
      end_at: record.end_at,
      location: record.location,
      status: record.status,
      created_by: record.created_by,
      series_id: record.series_id,
      series_modified: record.series_modified,
      discord_target_channel_id: null,
    });
  },
  update: (input: {
    id: Event.EventId;
    title: string;
    event_type: string;
    training_type_id: string | null;
    description: string | null;
    start_at: string;
    end_at: string | null;
    location: string | null;
  }) => {
    const event = eventsStore.get(input.id);
    if (!event) return Effect.die(new Error('Not found'));
    const updated = {
      ...event,
      title: input.title,
      event_type: input.event_type as Event.EventType,
      training_type_id: input.training_type_id,
      description: input.description,
      start_at: input.start_at,
      end_at: input.end_at,
      location: input.location,
    };
    eventsStore.set(input.id, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      training_type_id: updated.training_type_id,
      event_type: updated.event_type,
      title: updated.title,
      description: updated.description,
      start_at: updated.start_at,
      end_at: updated.end_at,
      location: updated.location,
      status: updated.status,
      created_by: updated.created_by,
      discord_target_channel_id: updated.discord_target_channel_id,
    });
  },
  updateEvent: (input: {
    id: Event.EventId;
    title: string;
    eventType: string;
    trainingTypeId: string | null;
    description: string | null;
    startAt: string;
    endAt: string | null;
    location: string | null;
  }) => {
    const event = eventsStore.get(input.id);
    if (!event) return Effect.die(new Error('Not found'));
    const updated = {
      ...event,
      title: input.title,
      event_type: input.eventType as Event.EventType,
      training_type_id: input.trainingTypeId,
      description: input.description,
      start_at: input.startAt,
      end_at: input.endAt,
      location: input.location,
    };
    eventsStore.set(input.id, updated);
    return Effect.succeed({
      id: updated.id,
      team_id: updated.team_id,
      training_type_id: updated.training_type_id,
      event_type: updated.event_type,
      title: updated.title,
      description: updated.description,
      start_at: updated.start_at,
      end_at: updated.end_at,
      location: updated.location,
      status: updated.status,
      created_by: updated.created_by,
      discord_target_channel_id: updated.discord_target_channel_id,
    });
  },
  cancel: (id: Event.EventId) => {
    const event = eventsStore.get(id);
    if (event) {
      eventsStore.set(id, { ...event, status: 'cancelled' });
    }
    return Effect.void;
  },
  cancelEvent: (id: Event.EventId) => {
    const event = eventsStore.get(id);
    if (event) {
      eventsStore.set(id, { ...event, status: 'cancelled' });
    }
    return Effect.void;
  },
  findScopedTrainingTypeIds: (memberId: TeamMember.TeamMemberId) => {
    if (memberId === TEST_CAPTAIN_MEMBER_ID) {
      return Effect.succeed([{ training_type_id: TEST_TRAINING_TYPE_A }]);
    }
    return Effect.succeed([]);
  },
  getScopedTrainingTypeIds: (memberId: TeamMember.TeamMemberId) => {
    if (memberId === TEST_CAPTAIN_MEMBER_ID) {
      return Effect.succeed([{ training_type_id: TEST_TRAINING_TYPE_A }]);
    }
    return Effect.succeed([]);
  },
  markModified: () => Effect.void,
  markEventSeriesModified: () => Effect.void,
  cancelFuture: () => Effect.void,
  cancelFutureInSeries: () => Effect.void,
  updateFutureUnmodified: () => Effect.void,
  updateFutureUnmodifiedInSeries: () => Effect.void,
} as unknown as EventsRepository);

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
} as unknown as DiscordChannelMappingRepository);

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

const MockEventRsvpsRepositoryLayer = Layer.succeed(EventRsvpsRepository, {
  _tag: 'api/EventRsvpsRepository',
  findByEventId: () => Effect.succeed([]),
  findRsvpsByEventId: () => Effect.succeed([]),
  findByEventAndMember: () => Effect.succeed(Option.none()),
  findRsvpByEventAndMember: () => Effect.succeed(Option.none()),
  upsert: () => Effect.die(new Error('Not implemented')),
  upsertRsvp: () => Effect.die(new Error('Not implemented')),
  countByEventId: () => Effect.succeed([]),
  countRsvpsByEventId: () => Effect.succeed([]),
} as unknown as EventRsvpsRepository);

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

describe('Events API', () => {
  describe('GET /teams/:teamId/events (list)', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(BASE));
      expect(response.status).toBe(401);
    });

    it('returns 200 with canCreate:true for admin', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer admin-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canCreate).toBe(true);
      expect(body.events).toHaveLength(3);
    });

    it('returns 200 with canCreate:true for captain', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer captain-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canCreate).toBe(true);
    });

    it('returns 200 with canCreate:false for regular player', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer user-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canCreate).toBe(false);
      expect(body.events).toHaveLength(3);
    });
  });

  describe('POST /teams/:teamId/events (create)', () => {
    const createPayload = {
      title: 'New Training',
      eventType: 'training',
      trainingTypeId: null,
      description: null,
      startAt: '2026-03-20T18:00:00',
      endAt: null,
      discordChannelId: null,
      location: null,
    };

    it('returns 201 for admin creating event', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.title).toBe('New Training');
      expect(body.eventType).toBe('training');
    });

    it('returns 201 for captain creating event', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer captain-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
        }),
      );
      expect(response.status).toBe(201);
    });

    it('returns 403 for player creating event', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('GET /teams/:teamId/events/:eventId (get)', () => {
    it('returns 200 with canEdit/canCancel for admin on active event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canEdit).toBe(true);
      expect(body.canCancel).toBe(true);
      expect(body.title).toBe('Tuesday Training');
    });

    it('returns 200 with canEdit:false/canCancel:false on cancelled event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_2}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canEdit).toBe(false);
      expect(body.canCancel).toBe(false);
      expect(body.status).toBe('cancelled');
    });

    it('returns 200 with canEdit:false/canCancel:false for player', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}`, {
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canEdit).toBe(false);
      expect(body.canCancel).toBe(false);
    });

    it('returns 404 for unknown event', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`${BASE}/${unknownId}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /teams/:teamId/events/:eventId (update)', () => {
    it('returns 200 for admin updating event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Renamed Training',
          }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Renamed Training');
    });

    it('returns 403 for player updating event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer user-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Should Fail',
          }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 when updating cancelled event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_2}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Try Update',
          }),
        }),
      );
      expect(response.status).toBe(400);
    });
  });

  describe('POST /teams/:teamId/events/:eventId/cancel', () => {
    it('returns 204 for admin cancelling event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}/cancel`, {
          method: 'POST',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });

    it('returns 403 for player cancelling event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_1}/cancel`, {
          method: 'POST',
          headers: { Authorization: 'Bearer user-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 when cancelling already cancelled event', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_2}/cancel`, {
          method: 'POST',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(400);
    });
  });

  describe('Coach scoping', () => {
    it('captain can create event with allowed training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer captain-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Scoped Event',
            eventType: 'training',
            trainingTypeId: TEST_TRAINING_TYPE_A,
            description: null,
            startAt: '2026-03-20T18:00:00',
            endAt: null,
            location: null,
            discordChannelId: null,
          }),
        }),
      );
      expect(response.status).toBe(201);
    });

    it('captain cannot create event with disallowed training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer captain-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Blocked Event',
            eventType: 'training',
            trainingTypeId: TEST_TRAINING_TYPE_B,
            description: null,
            startAt: '2026-03-20T18:00:00',
            endAt: null,
            location: null,
            discordChannelId: null,
          }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('captain can update event with allowed training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_SCOPED}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer captain-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Updated Scoped',
            trainingTypeId: TEST_TRAINING_TYPE_A,
          }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Updated Scoped');
    });

    it('captain cannot update event to disallowed training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_SCOPED}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer captain-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trainingTypeId: TEST_TRAINING_TYPE_B,
          }),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('captain can cancel event with allowed training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_EVENT_SCOPED}/cancel`, {
          method: 'POST',
          headers: { Authorization: 'Bearer captain-token' },
        }),
      );
      expect(response.status).toBe(204);
    });

    it('admin bypasses coach scoping for disallowed training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Admin Event',
            eventType: 'training',
            trainingTypeId: TEST_TRAINING_TYPE_B,
            description: null,
            startAt: '2026-03-20T18:00:00',
            endAt: null,
            location: null,
            discordChannelId: null,
          }),
        }),
      );
      expect(response.status).toBe(201);
    });
  });
});
