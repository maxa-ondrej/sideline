import {
  type ActivityLog,
  ActivityRpcGroup,
  ActivityRpcModels,
  ActivityStats,
  type Discord,
} from '@sideline/domain';
import { Bind, Options } from '@sideline/effect-lib';
import { DateTime, Effect, type Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

export const ActivityRpcLive = Effect.Do.pipe(
  Effect.bind('teams', () => TeamsRepository),
  Effect.bind('users', () => UsersRepository),
  Effect.bind('members', () => TeamMembersRepository),
  Effect.bind('activityLogs', () => ActivityLogsRepository),
  Effect.let(
    'Activity/LogActivity',
    ({ teams, users, members, activityLogs }) =>
      ({
        guild_id,
        discord_user_id,
        activity_type,
        duration_minutes,
        note,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly discord_user_id: Discord.Snowflake;
        readonly activity_type: ActivityLog.ActivityType;
        readonly duration_minutes: Option.Option<number>;
        readonly note: Option.Option<string>;
      }) =>
        Effect.Do.pipe(
          Effect.bind('team', () =>
            teams
              .findByGuildId(guild_id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityGuildNotFound()),
                ),
              ),
          ),
          Effect.bind('user', () =>
            users
              .findByDiscordId(discord_user_id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityMemberNotFound()),
                ),
              ),
          ),
          Effect.bind('member', ({ team, user }) =>
            members
              .findMembershipByIds(team.id, user.id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityMemberNotFound()),
                ),
              ),
          ),
          Effect.tap(({ member }) =>
            member.active
              ? Effect.void
              : Effect.fail(new ActivityRpcModels.ActivityMemberNotFound()),
          ),
          Effect.flatMap(({ member }) =>
            activityLogs.insert({
              team_member_id: member.id,
              activity_type,
              logged_at: DateTime.toDateUtc(DateTime.unsafeNow()),
              duration_minutes,
              note,
              source: 'manual',
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
        ),
  ),
  Effect.let(
    'Activity/GetStats',
    ({ teams, users, members, activityLogs }) =>
      ({
        guild_id,
        discord_user_id,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly discord_user_id: Discord.Snowflake;
      }) =>
        Effect.Do.pipe(
          Effect.bind('team', () =>
            teams
              .findByGuildId(guild_id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityGuildNotFound()),
                ),
              ),
          ),
          Effect.bind('user', () =>
            users
              .findByDiscordId(discord_user_id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityMemberNotFound()),
                ),
              ),
          ),
          Effect.bind('member', ({ team, user }) =>
            members
              .findMembershipByIds(team.id, user.id)
              .pipe(
                Effect.flatMap(
                  Options.toEffect(() => new ActivityRpcModels.ActivityMemberNotFound()),
                ),
              ),
          ),
          Effect.tap(({ member }) =>
            member.active
              ? Effect.void
              : Effect.fail(new ActivityRpcModels.ActivityMemberNotFound()),
          ),
          Effect.bind('rows', ({ member }) => activityLogs.findByTeamMember(member.id)),
          Effect.map(({ rows }) => {
            const stats = ActivityStats.calculateStats(rows, ActivityStats.todayInPrague());
            return new ActivityRpcModels.GetStatsResult({
              current_streak: stats.currentStreak,
              longest_streak: stats.longestStreak,
              total_activities: stats.totalActivities,
              total_duration_minutes: stats.totalDurationMinutes,
              gym_count: stats.gymCount,
              running_count: stats.runningCount,
              stretching_count: stats.stretchingCount,
            });
          }),
        ),
  ),
  Bind.remove('teams'),
  Bind.remove('users'),
  Bind.remove('members'),
  Bind.remove('activityLogs'),
  (handlers) => ActivityRpcGroup.ActivityRpcGroup.toLayer(handlers),
);
