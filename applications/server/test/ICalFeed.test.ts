import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type { Auth, Role, Team, TeamMember } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { ICalTokensRepository } from '~/repositories/ICalTokensRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { OAuthConnectionsRepository } from '~/repositories/OAuthConnectionsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;

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

const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  username: 'testuser',
  avatar: Option.none<string>(),
  is_profile_complete: true,
  name: Option.some('Test User'),
  birth_date: Option.some(DateTime.unsafeMake('2000-01-01')),
  gender: Option.some('male' as const),
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testMembership: MembershipWithRole = {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  permissions: [...ADMIN_PERMISSIONS],
  role_names: ['Admin'],
};

// --- Token state ---
let storedToken: {
  id: string;
  user_id: string;
  token: string;
  created_at: Date;
} | null = null;

const MockICalTokensRepositoryLayer = Layer.succeed(ICalTokensRepository, {
  _tag: 'api/ICalTokensRepository',
  findByToken: (token: string) =>
    Effect.succeed(
      storedToken && storedToken.token === token ? Option.some(storedToken) : Option.none(),
    ),
  findByUserId: (userId: string) =>
    Effect.succeed(
      storedToken && storedToken.user_id === userId ? Option.some(storedToken) : Option.none(),
    ),
  create: (userId: string) => {
    storedToken = {
      id: 'ical-id-1',
      user_id: userId,
      token: 'generated-ical-token',
      created_at: new Date(),
    };
    return Effect.succeed(storedToken);
  },
  regenerate: (userId: string) => {
    storedToken = {
      id: 'ical-id-2',
      user_id: userId,
      token: 'regenerated-ical-token',
      created_at: new Date(),
    };
    return Effect.succeed(storedToken);
  },
} as unknown as ICalTokensRepository);

const testEvents = [
  {
    id: '00000000-0000-0000-0000-000000000060',
    title: 'Tuesday Training',
    description: Option.some('Bring your boots'),
    start_at: DateTime.unsafeMake('2026-03-15T18:00:00Z'),
    end_at: Option.some(DateTime.unsafeMake('2026-03-15T19:30:00Z')),
    location: Option.some('Main Field'),
    status: 'active',
    event_type: 'training',
    team_name: 'Test FC',
    rsvp_response: 'yes',
  },
  {
    id: '00000000-0000-0000-0000-000000000061',
    title: 'Match vs Rivals',
    description: Option.none<string>(),
    start_at: DateTime.unsafeMake('2026-03-20T15:00:00Z'),
    end_at: Option.none<DateTime.Utc>(),
    location: Option.none<string>(),
    status: 'active',
    event_type: 'match',
    team_name: 'Test FC',
    rsvp_response: 'maybe',
  },
];

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  _tag: 'api/EventsRepository',
  findEventsByTeamId: () => Effect.succeed([]),
  findEventByIdWithDetails: () => Effect.succeed(Option.none()),
  insertEvent: () => Effect.succeed({} as never),
  updateEvent: () => Effect.succeed({} as never),
  cancelEvent: () => Effect.void,
  getScopedTrainingTypeIds: () => Effect.succeed([]),
  saveDiscordMessageId: () => Effect.void,
  getDiscordMessageId: () => Effect.succeed(Option.none()),
  findEventsByChannelId: () => Effect.succeed([]),
  markReminderSent: () => Effect.void,
  markEventSeriesModified: () => Effect.void,
  cancelFutureInSeries: () => Effect.void,
  updateFutureUnmodifiedInSeries: () => Effect.void,
  findUpcomingByGuildId: () => Effect.succeed([]),
  countUpcomingByGuildId: () => Effect.succeed(0),
  findEventsByUserId: () => Effect.succeed(testEvents),
} as unknown as EventsRepository);

// --- Minimal mocks for other repos (same pattern as other test files) ---
const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  _tag: 'api/SessionsRepository',
  findByToken: (token: string) =>
    token === 'test-session-token'
      ? Effect.succeed(
          Option.some({
            id: 'sess-1',
            user_id: TEST_USER_ID,
            token: 'test-session-token',
            expires_at: DateTime.add(DateTime.unsafeNow(), { days: 30 }),
            created_at: DateTime.unsafeNow(),
          }),
        )
      : Effect.succeed(Option.none()),
  create: () => Effect.succeed({} as never),
  deleteByToken: () => Effect.void,
} as unknown as SessionsRepository);

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  _tag: 'api/UsersRepository',
  findById: () => Effect.succeed(Option.some(testUser)),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
  updateAdminProfile: () => Effect.succeed(testUser),
} as unknown as UsersRepository);

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  _tag: 'api/TeamMembersRepository',
  findByTeamAndUser: () => Effect.succeed(Option.some(testMembership)),
  findByTeam: () => Effect.succeed([testMembership]),
  findByUser: () => Effect.succeed([testMembership]),
  addMember: () => Effect.succeed({} as never),
  deactivateMember: () => Effect.void,
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  findByTeamDetailed: () => Effect.succeed([]),
  findByIdDetailed: () => Effect.succeed(Option.none()),
  updateMemberProfile: () => Effect.succeed(Option.none()),
  listRosters: () => Effect.succeed([]),
} as unknown as TeamMembersRepository);

// Stub layers for services we don't test here
const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  _tag: 'api/TeamsRepository',
  findById: () => Effect.succeed(Option.none()),
  insert: () => Effect.succeed({} as never),
} as unknown as TeamsRepository);
const MockRostersRepositoryLayer = Layer.succeed(RostersRepository, {
  _tag: 'api/RostersRepository',
} as unknown as RostersRepository);
const MockRolesRepositoryLayer = Layer.succeed(RolesRepository, {
  _tag: 'api/RolesRepository',
} as unknown as RolesRepository);
const MockGroupsRepositoryLayer = Layer.succeed(GroupsRepository, {
  _tag: 'api/GroupsRepository',
} as unknown as GroupsRepository);
const MockTrainingTypesRepositoryLayer = Layer.succeed(TrainingTypesRepository, {
  _tag: 'api/TrainingTypesRepository',
} as unknown as TrainingTypesRepository);
const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
} as unknown as TeamInvitesRepository);
const MockAgeThresholdRepositoryLayer = Layer.succeed(AgeThresholdRepository, {
  _tag: 'api/AgeThresholdRepository',
} as unknown as AgeThresholdRepository);
const MockNotificationsRepositoryLayer = Layer.succeed(NotificationsRepository, {
  _tag: 'api/NotificationsRepository',
} as unknown as NotificationsRepository);
const MockRoleSyncEventsRepositoryLayer = Layer.succeed(RoleSyncEventsRepository, {
  _tag: 'api/RoleSyncEventsRepository',
} as unknown as RoleSyncEventsRepository);
const MockChannelSyncEventsRepositoryLayer = Layer.succeed(ChannelSyncEventsRepository, {
  _tag: 'api/ChannelSyncEventsRepository',
} as unknown as ChannelSyncEventsRepository);
const MockEventSyncEventsRepositoryLayer = Layer.succeed(EventSyncEventsRepository, {
  _tag: 'api/EventSyncEventsRepository',
} as unknown as EventSyncEventsRepository);
const MockDiscordChannelMappingRepositoryLayer = Layer.succeed(DiscordChannelMappingRepository, {
  _tag: 'api/DiscordChannelMappingRepository',
} as unknown as DiscordChannelMappingRepository);
const MockBotGuildsRepositoryLayer = Layer.succeed(BotGuildsRepository, {
  _tag: 'api/BotGuildsRepository',
} as unknown as BotGuildsRepository);
const MockDiscordChannelsRepositoryLayer = Layer.succeed(DiscordChannelsRepository, {
  _tag: 'api/DiscordChannelsRepository',
} as unknown as DiscordChannelsRepository);
const MockEventRsvpsRepositoryLayer = Layer.succeed(EventRsvpsRepository, {
  _tag: 'api/EventRsvpsRepository',
} as unknown as EventRsvpsRepository);
const MockEventSeriesRepositoryLayer = Layer.succeed(EventSeriesRepository, {
  _tag: 'api/EventSeriesRepository',
} as unknown as EventSeriesRepository);
const MockOAuthConnectionsRepositoryLayer = Layer.succeed(OAuthConnectionsRepository, {
  _tag: 'api/OAuthConnectionsRepository',
} as unknown as OAuthConnectionsRepository);
const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {} as unknown as DiscordOAuth);
const MockAgeCheckServiceLayer = Layer.succeed(AgeCheckService, {} as unknown as AgeCheckService);
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
  Layer.provide(MockRostersRepositoryLayer),
  Layer.provide(MockRolesRepositoryLayer),
  Layer.provide(MockGroupsRepositoryLayer),
  Layer.provide(MockTrainingTypesRepositoryLayer),
  Layer.provide(MockTeamInvitesRepositoryLayer),
  Layer.provide(Layer.merge(MockHttpClientLayer, MockAgeCheckServiceLayer)),
  Layer.provide(MockAgeThresholdRepositoryLayer),
  Layer.provide(MockNotificationsRepositoryLayer),
  Layer.provide(MockRoleSyncEventsRepositoryLayer),
  Layer.provide(
    Layer.merge(MockChannelSyncEventsRepositoryLayer, MockEventSyncEventsRepositoryLayer),
  ),
  Layer.provide(
    Layer.merge(MockDiscordChannelMappingRepositoryLayer, MockICalTokensRepositoryLayer),
  ),
  Layer.provide(
    Layer.merge(
      Layer.merge(
        Layer.merge(
          Layer.merge(
            Layer.merge(MockEventsRepositoryLayer, MockEventRsvpsRepositoryLayer),
            MockBotGuildsRepositoryLayer,
          ),
          MockDiscordChannelsRepositoryLayer,
        ),
        MockEventSeriesRepositoryLayer,
      ),
      Layer.succeed(TeamSettingsRepository, {
        _tag: 'api/TeamSettingsRepository',
        findByTeam: () => Effect.succeed(Option.none()),
        findByTeamId: () => Effect.succeed(Option.none()),
        upsert: () => Effect.succeed({ team_id: 'test', event_horizon_days: 30 }),
        getHorizonDays: () => Effect.succeed(30),
      } as unknown as TeamSettingsRepository),
    ),
  ),
  Layer.provide(MockOAuthConnectionsRepositoryLayer),
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

describe('iCal Subscription API', () => {
  beforeAll(() => {
    storedToken = null;
  });

  it('GET /me/ical-token creates a token when none exists', async () => {
    storedToken = null;
    const response = await handler(
      new Request('http://localhost/me/ical-token', {
        headers: { Authorization: 'Bearer test-session-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe('generated-ical-token');
    expect(body.url).toContain('webcal://');
    expect(body.url).toContain('/ical/generated-ical-token');
  });

  it('GET /me/ical-token returns existing token', async () => {
    storedToken = {
      id: 'ical-id-existing',
      user_id: TEST_USER_ID,
      token: 'existing-ical-token',
      created_at: new Date(),
    };
    const response = await handler(
      new Request('http://localhost/me/ical-token', {
        headers: { Authorization: 'Bearer test-session-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe('existing-ical-token');
  });

  it('POST /me/ical-token/regenerate rotates the token', async () => {
    const response = await handler(
      new Request('http://localhost/me/ical-token/regenerate', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session-token' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe('regenerated-ical-token');
    expect(body.url).toContain('/ical/regenerated-ical-token');
  });

  it('GET /me/ical-token without auth returns 401', async () => {
    const response = await handler(new Request('http://localhost/me/ical-token'));
    expect(response.status).toBe(401);
  });

  it('GET /ical/:token with valid token returns iCalendar feed', async () => {
    storedToken = {
      id: 'ical-id-1',
      user_id: TEST_USER_ID,
      token: 'feed-token',
      created_at: new Date(),
    };
    const response = await handler(new Request('http://localhost/ical/feed-token'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    const text = await response.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('CALNAME:Test FC - Sideline events');
    expect(text).toContain('X-WR-CALNAME:Test FC - Sideline events');
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('SUMMARY:Tuesday Training');
    expect(text).not.toContain('SUMMARY:[Test FC]');
    expect(text).toContain('DESCRIPTION:Bring your boots');
    expect(text).toContain('LOCATION:Main Field');
    expect(text).toContain('SUMMARY:[Maybe] Match vs Rivals');
    expect(text).toContain('END:VCALENDAR');
    expect(text).toContain('STATUS:CONFIRMED');
  });

  it('GET /ical/:token without auth header works (public endpoint)', async () => {
    storedToken = {
      id: 'ical-id-1',
      user_id: TEST_USER_ID,
      token: 'public-token',
      created_at: new Date(),
    };
    const response = await handler(new Request('http://localhost/ical/public-token'));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('BEGIN:VCALENDAR');
  });

  it('GET /ical/:token with invalid token returns 404', async () => {
    storedToken = null;
    const response = await handler(new Request('http://localhost/ical/invalid-token'));
    expect(response.status).toBe(404);
  });
});
