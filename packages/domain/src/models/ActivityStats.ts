import { Option } from 'effect';

export interface StreakResult {
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface StatsResult {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly totalActivities: number;
  readonly totalDurationMinutes: number;
  readonly gymCount: number;
  readonly runningCount: number;
  readonly stretchingCount: number;
}

/** Calculate current and longest streaks from a list of activity dates (ISO date strings like "2026-03-25"). */
export const calculateStreaks = (dates: ReadonlyArray<string>, today: string): StreakResult => {
  const uniqueDates = [...new Set(dates)].sort();
  if (uniqueDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Calculate longest streak by walking sorted dates forward
  let longestStreak = 1;
  let currentRun = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = uniqueDates[i - 1];
    const curr = uniqueDates[i];
    if (prev !== undefined && curr !== undefined && daysBetween(prev, curr) === 1) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // Calculate current streak: walk backwards from today or yesterday
  const lastDate = uniqueDates[uniqueDates.length - 1];
  if (lastDate === undefined) return { currentStreak: 0, longestStreak: 0 };
  const gapFromToday = daysBetween(lastDate, today);

  // If most recent activity is more than 1 day ago, current streak is 0
  if (gapFromToday > 1) return { currentStreak: 0, longestStreak };

  let currentStreak = 1;
  for (let i = uniqueDates.length - 2; i >= 0; i--) {
    const curr = uniqueDates[i];
    const next = uniqueDates[i + 1];
    if (curr !== undefined && next !== undefined && daysBetween(curr, next) === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
};

/** Calculate full stats from activity rows. */
export const calculateStats = (
  rows: ReadonlyArray<{
    readonly activity_type: 'gym' | 'running' | 'stretching' | 'training';
    readonly logged_at_date: string;
    readonly duration_minutes: Option.Option<number>;
  }>,
  today: string,
): StatsResult => {
  if (rows.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActivities: 0,
      totalDurationMinutes: 0,
      gymCount: 0,
      runningCount: 0,
      stretchingCount: 0,
    };
  }

  const dates = rows.map((r) => r.logged_at_date);
  const { currentStreak, longestStreak } = calculateStreaks(dates, today);

  let totalDurationMinutes = 0;
  let gymCount = 0;
  let runningCount = 0;
  let stretchingCount = 0;

  for (const row of rows) {
    totalDurationMinutes += Option.getOrElse(row.duration_minutes, () => 0);
    switch (row.activity_type) {
      case 'gym':
        gymCount++;
        break;
      case 'running':
        runningCount++;
        break;
      case 'stretching':
        stretchingCount++;
        break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActivities: rows.length,
    totalDurationMinutes,
    gymCount,
    runningCount,
    stretchingCount,
  };
};

/** Returns today's date as an ISO string in the Europe/Prague timezone. */
export const todayInPrague = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

/** Returns the number of days between two ISO date strings. Always positive. Inputs must be date-only strings (UTC midnight). */
const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86400000;
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
};
