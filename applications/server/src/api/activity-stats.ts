import { ActivityStats, ActivityStatsApi, Auth } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

export const ActivityStatsApiLive = HttpApiBuilder.group(Api, 'activityStats', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.map(({ members, activityLogs }) =>
      handlers.handle('getMemberStats', ({ path: { teamId, memberId } }) =>
        Effect.Do.pipe(
          Effect.bind('currentUser', () => Auth.CurrentUserContext),
          Effect.bind('membership', ({ currentUser }) =>
            requireMembership(members, teamId, currentUser.id, new ActivityStatsApi.Forbidden()),
          ),
          Effect.tap(({ membership }) =>
            requirePermission(membership, 'member:view', new ActivityStatsApi.Forbidden()),
          ),
          Effect.tap(() =>
            members.findRosterMemberByIds(teamId, memberId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new ActivityStatsApi.MemberNotFound()),
                  onSome: Effect.succeed,
                }),
              ),
            ),
          ),
          Effect.bind('rows', () => activityLogs.findByTeamMember(memberId)),
          Effect.map(({ rows }) => {
            const stats = ActivityStats.calculateStats(rows, ActivityStats.todayInPrague());
            return new ActivityStatsApi.ActivityStatsResponse({
              currentStreak: stats.currentStreak,
              longestStreak: stats.longestStreak,
              totalActivities: stats.totalActivities,
              totalDurationMinutes: stats.totalDurationMinutes,
              counts: stats.counts,
            });
          }),
        ),
      ),
    ),
  ),
);
