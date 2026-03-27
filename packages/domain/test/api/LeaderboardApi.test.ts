import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';
import * as LeaderboardApi from '~/api/LeaderboardApi.js';
import type { TeamMemberId } from '~/models/TeamMember.js';
import type { UserId } from '~/models/User.js';

const MOCK_MEMBER_ID = '00000000-0000-0000-0000-000000000001' as TeamMemberId;
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000010' as UserId;

describe('LeaderboardEntry', () => {
  it('decodes valid leaderboard entry data', () => {
    const result = Schema.decodeUnknownSync(LeaderboardApi.LeaderboardEntry)({
      rank: 1,
      teamMemberId: MOCK_MEMBER_ID,
      userId: MOCK_USER_ID,
      username: 'alice',
      totalActivities: 10,
      totalDurationMinutes: 300,
      currentStreak: 5,
      longestStreak: 7,
    });
    expect(result.rank).toBe(1);
    expect(result.teamMemberId).toBe(MOCK_MEMBER_ID);
    expect(result.userId).toBe(MOCK_USER_ID);
    expect(result.username).toBe('alice');
    expect(result.totalActivities).toBe(10);
    expect(result.totalDurationMinutes).toBe(300);
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(7);
  });

  it('rejects invalid rank (negative)', () => {
    expect(() =>
      Schema.decodeUnknownSync(LeaderboardApi.LeaderboardEntry)({
        rank: -1,
        teamMemberId: MOCK_MEMBER_ID,
        userId: MOCK_USER_ID,
        username: 'alice',
        totalActivities: 10,
        totalDurationMinutes: 300,
        currentStreak: 5,
        longestStreak: 7,
      }),
    ).toThrow();
  });
});

describe('LeaderboardResponse', () => {
  it('decodes valid response with entries array', () => {
    const result = Schema.decodeUnknownSync(LeaderboardApi.LeaderboardResponse)({
      entries: [
        {
          rank: 1,
          teamMemberId: MOCK_MEMBER_ID,
          userId: MOCK_USER_ID,
          username: 'alice',
          totalActivities: 10,
          totalDurationMinutes: 300,
          currentStreak: 5,
          longestStreak: 7,
        },
        {
          rank: 2,
          teamMemberId: '00000000-0000-0000-0000-000000000002' as TeamMemberId,
          userId: '00000000-0000-0000-0000-000000000020' as UserId,
          username: 'bob',
          totalActivities: 6,
          totalDurationMinutes: 120,
          currentStreak: 2,
          longestStreak: 3,
        },
      ],
    });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].username).toBe('alice');
    expect(result.entries[1].rank).toBe(2);
    expect(result.entries[1].username).toBe('bob');
  });
});
