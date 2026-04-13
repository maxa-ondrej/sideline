import { ActivityStats, Auth, Leaderboard, LeaderboardApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Api } from '~/api/api.js';
import { requireMembership } from '~/api/permissions.js';
import { LeaderboardRepository } from '~/repositories/LeaderboardRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

export const LeaderboardApiLive = HttpApiBuilder.group(Api, 'leaderboard', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('leaderboard', () => LeaderboardRepository),
    Effect.map(({ members, leaderboard }) =>
      handlers.handle(
        'getLeaderboard',
        ({ path: { teamId }, urlParams: { timeframe, activityTypeId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.tap(({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new LeaderboardApi.Forbidden()),
            ),
            Effect.bind('rows', () =>
              leaderboard.getLeaderboard(
                teamId,
                activityTypeId,
                Option.getOrElse(timeframe, () => 'all' as const),
              ),
            ),
            Effect.map(({ rows }) => {
              const today = ActivityStats.todayInPrague();

              const memberData = rows.map((row) => {
                const streaks = ActivityStats.calculateStreaks(row.activity_dates, today);
                return {
                  teamMemberId: row.team_member_id,
                  userId: row.user_id,
                  username: row.username,
                  totalActivities: row.total_activities,
                  totalDurationMinutes: row.total_duration_minutes,
                  currentStreak: streaks.currentStreak,
                  longestStreak: streaks.longestStreak,
                };
              });

              const ranked = Leaderboard.rankLeaderboard(memberData);

              const entries = ranked.map((entry) => {
                const row = rows.find((r) => r.team_member_id === entry.teamMemberId);
                return new LeaderboardApi.LeaderboardEntry({
                  rank: entry.rank,
                  teamMemberId: entry.teamMemberId,
                  userId: entry.userId,
                  username: entry.username,
                  name: row ? row.name : Option.none(),
                  avatar: row ? row.avatar : Option.none(),
                  totalActivities: entry.totalActivities,
                  totalDurationMinutes: entry.totalDurationMinutes,
                  currentStreak: entry.currentStreak,
                  longestStreak: entry.longestStreak,
                });
              });

              return new LeaderboardApi.LeaderboardResponse({ entries });
            }),
          ),
      ),
    ),
  ),
);
