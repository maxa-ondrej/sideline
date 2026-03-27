import { Schema } from 'effect';
import type { TeamMemberId } from '~/models/TeamMember.js';
import type { UserId } from '~/models/User.js';

export const LeaderboardTimeframe = Schema.Literal('all', 'week');
export type LeaderboardTimeframe = typeof LeaderboardTimeframe.Type;

export interface LeaderboardEntryInput {
  readonly teamMemberId: TeamMemberId;
  readonly userId: UserId;
  readonly username: string;
  readonly totalActivities: number;
  readonly totalDurationMinutes: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntryInput {
  readonly rank: number;
}

/** Rank leaderboard entries by totalActivities desc, breaking ties by totalDurationMinutes desc. */
export const rankLeaderboard = (
  entries: ReadonlyArray<LeaderboardEntryInput>,
): ReadonlyArray<RankedLeaderboardEntry> => {
  const sorted = [...entries].sort((a, b) => {
    if (b.totalActivities !== a.totalActivities) {
      return b.totalActivities - a.totalActivities;
    }
    return b.totalDurationMinutes - a.totalDurationMinutes;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};
