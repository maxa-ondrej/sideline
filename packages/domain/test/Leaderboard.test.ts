import { describe, expect, it } from '@effect/vitest';
import { rankLeaderboard } from '~/models/Leaderboard.js';
import type { TeamMemberId } from '~/models/TeamMember.js';
import type { UserId } from '~/models/User.js';

describe('rankLeaderboard', () => {
  it('returns empty array for empty input', () => {
    const result = rankLeaderboard([]);
    expect(result).toEqual([]);
  });

  it('ranks members by total activities descending', () => {
    const entries = [
      {
        teamMemberId: 'member-1' as TeamMemberId,
        userId: 'user-1' as UserId,
        username: 'alice',
        totalActivities: 5,
        totalDurationMinutes: 100,
        currentStreak: 2,
        longestStreak: 4,
      },
      {
        teamMemberId: 'member-2' as TeamMemberId,
        userId: 'user-2' as UserId,
        username: 'bob',
        totalActivities: 10,
        totalDurationMinutes: 200,
        currentStreak: 3,
        longestStreak: 6,
      },
      {
        teamMemberId: 'member-3' as TeamMemberId,
        userId: 'user-3' as UserId,
        username: 'carol',
        totalActivities: 7,
        totalDurationMinutes: 150,
        currentStreak: 1,
        longestStreak: 2,
      },
    ];
    const result = rankLeaderboard(entries);
    expect(result[0].username).toBe('bob');
    expect(result[1].username).toBe('carol');
    expect(result[2].username).toBe('alice');
  });

  it('breaks ties by total duration minutes', () => {
    const entries = [
      {
        teamMemberId: 'member-1' as TeamMemberId,
        userId: 'user-1' as UserId,
        username: 'alice',
        totalActivities: 5,
        totalDurationMinutes: 60,
        currentStreak: 1,
        longestStreak: 1,
      },
      {
        teamMemberId: 'member-2' as TeamMemberId,
        userId: 'user-2' as UserId,
        username: 'bob',
        totalActivities: 5,
        totalDurationMinutes: 120,
        currentStreak: 2,
        longestStreak: 2,
      },
    ];
    const result = rankLeaderboard(entries);
    expect(result[0].username).toBe('bob');
    expect(result[1].username).toBe('alice');
  });

  it('assigns correct rank numbers', () => {
    const entries = [
      {
        teamMemberId: 'member-1' as TeamMemberId,
        userId: 'user-1' as UserId,
        username: 'alice',
        totalActivities: 3,
        totalDurationMinutes: 30,
        currentStreak: 0,
        longestStreak: 1,
      },
      {
        teamMemberId: 'member-2' as TeamMemberId,
        userId: 'user-2' as UserId,
        username: 'bob',
        totalActivities: 10,
        totalDurationMinutes: 200,
        currentStreak: 5,
        longestStreak: 5,
      },
      {
        teamMemberId: 'member-3' as TeamMemberId,
        userId: 'user-3' as UserId,
        username: 'carol',
        totalActivities: 7,
        totalDurationMinutes: 140,
        currentStreak: 3,
        longestStreak: 4,
      },
    ];
    const result = rankLeaderboard(entries);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
    expect(result[0].teamMemberId).toBe('member-2');
    expect(result[1].teamMemberId).toBe('member-3');
    expect(result[2].teamMemberId).toBe('member-1');
  });

  it('handles members with zero duration', () => {
    const entries = [
      {
        teamMemberId: 'member-1' as TeamMemberId,
        userId: 'user-1' as UserId,
        username: 'alice',
        totalActivities: 4,
        totalDurationMinutes: 0,
        currentStreak: 1,
        longestStreak: 2,
      },
      {
        teamMemberId: 'member-2' as TeamMemberId,
        userId: 'user-2' as UserId,
        username: 'bob',
        totalActivities: 4,
        totalDurationMinutes: 90,
        currentStreak: 1,
        longestStreak: 1,
      },
    ];
    const result = rankLeaderboard(entries);
    expect(result[0].username).toBe('bob');
    expect(result[0].rank).toBe(1);
    expect(result[1].username).toBe('alice');
    expect(result[1].rank).toBe(2);
  });
});
