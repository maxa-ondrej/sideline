import { describe, expect, it } from '@effect/vitest';
import { Option } from 'effect';
import { calculateStats, calculateStreaks } from '~/models/ActivityStats.js';

describe('calculateStreaks', () => {
  it('returns zeros for empty input', () => {
    const result = calculateStreaks([], '2026-03-25');
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('returns streak of 1 for single activity today', () => {
    const result = calculateStreaks(['2026-03-25'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 });
  });

  it('returns streak of 1 for single activity yesterday', () => {
    const result = calculateStreaks(['2026-03-24'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 });
  });

  it('returns currentStreak 0 for single activity two days ago (broken streak)', () => {
    const result = calculateStreaks(['2026-03-23'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 0, longestStreak: 1 });
  });

  it('returns streak of 3 for three consecutive days ending today', () => {
    const result = calculateStreaks(['2026-03-23', '2026-03-24', '2026-03-25'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('returns streak of 3 for three consecutive days ending yesterday', () => {
    const result = calculateStreaks(['2026-03-22', '2026-03-23', '2026-03-24'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('handles a gap in the middle correctly', () => {
    // 2026-03-21 then gap on 2026-03-22, then 2026-03-23 and 2026-03-24
    const result = calculateStreaks(['2026-03-21', '2026-03-23', '2026-03-24'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 2, longestStreak: 2 });
  });

  it('tracks longest streak in the past when current streak is shorter', () => {
    // Long streak: 2026-03-01 through 2026-03-05 (5 days)
    // Gap
    // Current streak: 2026-03-24 and 2026-03-25 (2 days)
    const result = calculateStreaks(
      [
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-24',
        '2026-03-25',
      ],
      '2026-03-25',
    );
    expect(result).toEqual({ currentStreak: 2, longestStreak: 5 });
  });

  it('deduplicates dates with multiple activities on the same day', () => {
    // Two entries for 2026-03-24 (should deduplicate to one day)
    const result = calculateStreaks(['2026-03-24', '2026-03-24', '2026-03-25'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 2, longestStreak: 2 });
  });

  it('returns currentStreak 0 for activities only far in the past', () => {
    const result = calculateStreaks(['2026-01-10'], '2026-03-25');
    expect(result).toEqual({ currentStreak: 0, longestStreak: 1 });
  });
});

describe('calculateStats', () => {
  it('returns all zeros for empty input', () => {
    const result = calculateStats([], '2026-03-25');
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalActivities: 0,
      totalDurationMinutes: 0,
      gymCount: 0,
      runningCount: 0,
      stretchingCount: 0,
    });
  });

  it('calculates correct totals and per-type counts for mixed activities', () => {
    const rows = [
      { activity_type: 'gym', logged_at_date: '2026-03-23', duration_minutes: Option.some(60) },
      {
        activity_type: 'running',
        logged_at_date: '2026-03-24',
        duration_minutes: Option.some(30),
      },
      {
        activity_type: 'stretching',
        logged_at_date: '2026-03-25',
        duration_minutes: Option.some(15),
      },
    ];
    const result = calculateStats(rows, '2026-03-25');
    expect(result).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      totalActivities: 3,
      totalDurationMinutes: 105,
      gymCount: 1,
      runningCount: 1,
      stretchingCount: 1,
    });
  });

  it('treats Option.none duration as 0 when summing durations', () => {
    const rows = [
      { activity_type: 'gym', logged_at_date: '2026-03-24', duration_minutes: Option.some(45) },
      { activity_type: 'gym', logged_at_date: '2026-03-25', duration_minutes: Option.none() },
    ];
    const result = calculateStats(rows, '2026-03-25');
    expect(result).toEqual({
      currentStreak: 2,
      longestStreak: 2,
      totalActivities: 2,
      totalDurationMinutes: 45,
      gymCount: 2,
      runningCount: 0,
      stretchingCount: 0,
    });
  });

  it('returns correct count for a single activity type with zeros for others', () => {
    const rows = [
      { activity_type: 'running', logged_at_date: '2026-03-23', duration_minutes: Option.some(20) },
      { activity_type: 'running', logged_at_date: '2026-03-24', duration_minutes: Option.some(25) },
      { activity_type: 'running', logged_at_date: '2026-03-25', duration_minutes: Option.some(30) },
    ];
    const result = calculateStats(rows, '2026-03-25');
    expect(result).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      totalActivities: 3,
      totalDurationMinutes: 75,
      gymCount: 0,
      runningCount: 3,
      stretchingCount: 0,
    });
  });
});
