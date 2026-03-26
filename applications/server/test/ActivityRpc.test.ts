import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { ActivityLog, Discord, Team, TeamMember } from '@sideline/domain';
import { ActivityRpcModels } from '@sideline/domain';
import { DateTime, Effect, Either, Layer, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

// --- Test IDs ---
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_GUILD_ID = '999999999999999999' as Discord.Snowflake;
const TEST_DISCORD_USER_ID = '111111111111111111' as Discord.Snowflake;
const TEST_UNKNOWN_DISCORD_USER_ID = '000000000000000002' as Discord.Snowflake;
const TEST_ACTIVITY_LOG_ID = 'activity-log-uuid-001' as ActivityLog.ActivityLogId;
const TEST_USER_ID = 'user-uuid-001';

// --- In-memory stores ---
type ActivityLogInserted = {
  team_member_id: TeamMember.TeamMemberId;
  activity_type: ActivityLog.ActivityType;
  logged_at: Date;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
};

let activityLogsInserted: ActivityLogInserted[];

const resetStores = () => {
  activityLogsInserted = [];
};

// --- Mock layers ---
const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  findByGuildId: (guildId: string) => {
    if (guildId === TEST_GUILD_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_TEAM_ID,
          name: 'Test Team',
          guild_id: TEST_GUILD_ID,
          created_by: 'user-1',
          created_at: DateTime.unsafeNow(),
          updated_at: DateTime.unsafeNow(),
        }),
      );
    return Effect.succeed(Option.none());
  },
  findById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
} as unknown as TeamsRepository);

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  findByDiscordId: (discordId: string) => {
    if (discordId === TEST_DISCORD_USER_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_USER_ID,
          discord_id: TEST_DISCORD_USER_ID,
          username: 'testplayer',
          avatar: Option.none(),
          name: Option.none(),
          birth_date: Option.none(),
          gender: Option.none(),
          locale: Option.none(),
          is_profile_complete: false,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      );
    return Effect.succeed(Option.none());
  },
  findById: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.die(new Error('Not implemented')),
  completeProfile: () => Effect.die(new Error('Not implemented')),
  updateLocale: () => Effect.die(new Error('Not implemented')),
  updateAdminProfile: () => Effect.die(new Error('Not implemented')),
} as unknown as UsersRepository);

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  findMembershipByIds: (teamId: string, userId: string) => {
    if (teamId === TEST_TEAM_ID && userId === TEST_USER_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_MEMBER_ID,
          team_id: TEST_TEAM_ID,
          user_id: TEST_USER_ID,
          active: true,
          role_names: ['Player'],
          permissions: [] as string[],
        }),
      );
    return Effect.succeed(Option.none());
  },
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
  findRosterByTeam: () => Effect.succeed([]),
  findRosterMemberByIds: () => Effect.succeed(Option.none()),
  addMember: () => Effect.die(new Error('Not implemented')),
  deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
  getPlayerRoleId: () => Effect.succeed(Option.none()),
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  setJerseyNumber: () => Effect.void,
} as unknown as TeamMembersRepository);

const MockActivityLogsRepositoryLayer = Layer.succeed(ActivityLogsRepository, {
  insert: (input: ActivityLogInserted) => {
    activityLogsInserted.push(input);
    return Effect.succeed({
      id: TEST_ACTIVITY_LOG_ID,
      activity_type: input.activity_type,
      logged_at: input.logged_at.toISOString(),
    });
  },
} as unknown as ActivityLogsRepository);

const MockProvideLayer = Layer.mergeAll(
  MockTeamsRepositoryLayer,
  MockUsersRepositoryLayer,
  MockTeamMembersRepositoryLayer,
  MockActivityLogsRepositoryLayer,
);

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  activityLogsInserted = [];
});

// --- Handler logic (mirrors actual RPC handler) ---
const logActivity = (payload: {
  guild_id: Discord.Snowflake;
  discord_user_id: Discord.Snowflake;
  activity_type: ActivityLog.ActivityType;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
}): Effect.Effect<
  ActivityRpcModels.LogActivityResult,
  ActivityRpcModels.ActivityGuildNotFound | ActivityRpcModels.ActivityMemberNotFound,
  TeamsRepository | UsersRepository | TeamMembersRepository | ActivityLogsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('teams', () => TeamsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('team', ({ teams }) =>
      teams.findByGuildId(payload.guild_id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail<ActivityRpcModels.ActivityGuildNotFound>(
                new ActivityRpcModels.ActivityGuildNotFound(),
              ),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.bind('user', ({ users }) =>
      users.findByDiscordId(payload.discord_user_id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail<ActivityRpcModels.ActivityMemberNotFound>(
                new ActivityRpcModels.ActivityMemberNotFound(),
              ),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.bind('member', ({ members, team, user }) =>
      members.findMembershipByIds(team.id, user.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail<ActivityRpcModels.ActivityMemberNotFound>(
                new ActivityRpcModels.ActivityMemberNotFound(),
              ),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ member }) =>
      member.active ? Effect.void : Effect.fail(new ActivityRpcModels.ActivityMemberNotFound()),
    ),
    Effect.flatMap(({ activityLogs, member }) =>
      activityLogs.insert({
        team_member_id: member.id,
        activity_type: payload.activity_type,
        logged_at: DateTime.toDateUtc(DateTime.unsafeNow()),
        duration_minutes: payload.duration_minutes,
        note: payload.note,
      }),
    ),
    Effect.map(
      (inserted) =>
        new ActivityRpcModels.LogActivityResult({
          id: inserted.id,
          activity_type: inserted.activity_type,
          logged_at: inserted.logged_at,
        }),
    ),
  );

describe('LogActivity RPC handler', () => {
  it.effect('succeeds for a valid guild member with activity_type gym', () =>
    logActivity({
      guild_id: TEST_GUILD_ID,
      discord_user_id: TEST_DISCORD_USER_ID,
      activity_type: 'gym',
      duration_minutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result.id).toBe(TEST_ACTIVITY_LOG_ID);
          expect(result.activity_type).toBe('gym');
          expect(activityLogsInserted).toHaveLength(1);
          expect(activityLogsInserted[0].activity_type).toBe('gym');
          expect(Option.isNone(activityLogsInserted[0].duration_minutes)).toBe(true);
          expect(Option.isNone(activityLogsInserted[0].note)).toBe(true);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('succeeds with duration_minutes and note provided', () =>
    logActivity({
      guild_id: TEST_GUILD_ID,
      discord_user_id: TEST_DISCORD_USER_ID,
      activity_type: 'running',
      duration_minutes: Option.some(30),
      note: Option.some('Leg day'),
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result.id).toBe(TEST_ACTIVITY_LOG_ID);
          expect(result.activity_type).toBe('running');
          expect(activityLogsInserted).toHaveLength(1);
          expect(Option.getOrNull(activityLogsInserted[0].duration_minutes)).toBe(30);
          expect(Option.getOrNull(activityLogsInserted[0].note)).toBe('Leg day');
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('fails with ActivityGuildNotFound for an unknown guild_id', () => {
    const unknownGuildId = '000000000000000001' as Discord.Snowflake;

    return logActivity({
      guild_id: unknownGuildId,
      discord_user_id: TEST_DISCORD_USER_ID,
      activity_type: 'gym',
      duration_minutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityGuildNotFound');
          }
          expect(activityLogsInserted).toHaveLength(0);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('fails with ActivityMemberNotFound for a valid guild but unknown discord user', () =>
    logActivity({
      guild_id: TEST_GUILD_ID,
      discord_user_id: TEST_UNKNOWN_DISCORD_USER_ID,
      activity_type: 'stretching',
      duration_minutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityMemberNotFound');
          }
          expect(activityLogsInserted).toHaveLength(0);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('fails with ActivityMemberNotFound for an inactive team member', () => {
    const InactiveMemberLayer = Layer.succeed(TeamMembersRepository, {
      findMembershipByIds: (teamId: string, userId: string) => {
        if (teamId === TEST_TEAM_ID && userId === TEST_USER_ID)
          return Effect.succeed(
            Option.some({
              id: TEST_MEMBER_ID,
              team_id: TEST_TEAM_ID,
              user_id: TEST_USER_ID,
              active: false,
              role_names: [] as string[],
              permissions: [] as string[],
            }),
          );
        return Effect.succeed(Option.none());
      },
      findByTeam: () => Effect.succeed([]),
      findByUser: () => Effect.succeed([]),
      findRosterByTeam: () => Effect.succeed([]),
      findRosterMemberByIds: () => Effect.succeed(Option.none()),
      addMember: () => Effect.die(new Error('Not implemented')),
      deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
      getPlayerRoleId: () => Effect.succeed(Option.none()),
      assignRole: () => Effect.void,
      unassignRole: () => Effect.void,
      setJerseyNumber: () => Effect.void,
    } as unknown as TeamMembersRepository);

    const LayerWithInactiveMember = Layer.mergeAll(
      MockTeamsRepositoryLayer,
      MockUsersRepositoryLayer,
      InactiveMemberLayer,
      MockActivityLogsRepositoryLayer,
    );

    return logActivity({
      guild_id: TEST_GUILD_ID,
      discord_user_id: TEST_DISCORD_USER_ID,
      activity_type: 'gym',
      duration_minutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityMemberNotFound');
          }
          expect(activityLogsInserted).toHaveLength(0);
        }),
      ),
      Effect.provide(LayerWithInactiveMember),
      Effect.asVoid,
    );
  });

  it.effect('accepts all valid activity types: gym, running, stretching', () =>
    Effect.Do.pipe(
      Effect.bind('gymResult', () =>
        logActivity({
          guild_id: TEST_GUILD_ID,
          discord_user_id: TEST_DISCORD_USER_ID,
          activity_type: 'gym',
          duration_minutes: Option.none(),
          note: Option.none(),
        }),
      ),
      Effect.bind('runningResult', () =>
        logActivity({
          guild_id: TEST_GUILD_ID,
          discord_user_id: TEST_DISCORD_USER_ID,
          activity_type: 'running',
          duration_minutes: Option.none(),
          note: Option.none(),
        }),
      ),
      Effect.bind('stretchingResult', () =>
        logActivity({
          guild_id: TEST_GUILD_ID,
          discord_user_id: TEST_DISCORD_USER_ID,
          activity_type: 'stretching',
          duration_minutes: Option.none(),
          note: Option.none(),
        }),
      ),
      Effect.tap(({ gymResult, runningResult, stretchingResult }) =>
        Effect.sync(() => {
          expect(gymResult.activity_type).toBe('gym');
          expect(runningResult.activity_type).toBe('running');
          expect(stretchingResult.activity_type).toBe('stretching');
          expect(activityLogsInserted).toHaveLength(3);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );
});
