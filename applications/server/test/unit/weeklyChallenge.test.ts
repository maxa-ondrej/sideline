// Unit tests for the WeeklyChallenge helpers (timezone-aware date math).

import { describe, expect, it } from '@effect/vitest';
import {
  currentTeamMondayDateString,
  formatDateInTz,
  scheduleAtNineAm,
  weekStartDateString,
} from '~/helpers/weeklyChallenge.js';

describe('formatDateInTz', () => {
  it('formats a UTC date as YYYY-MM-DD in the given timezone', () => {
    // 2026-03-09 00:00 UTC → in Europe/Prague that is 2026-03-09 01:00, so still the 9th.
    const date = new Date('2026-03-09T00:00:00Z');
    expect(formatDateInTz(date, 'Europe/Prague')).toBe('2026-03-09');
  });

  it('crosses date boundaries when timezone differs from UTC', () => {
    // 2026-03-09 23:30 UTC → in Pacific/Auckland that is the 10th already.
    const date = new Date('2026-03-09T23:30:00Z');
    expect(formatDateInTz(date, 'Pacific/Auckland')).toBe('2026-03-10');
    expect(formatDateInTz(date, 'America/Los_Angeles')).toBe('2026-03-09');
  });
});

describe('weekStartDateString', () => {
  it('returns the date string for the team timezone', () => {
    const date = new Date('2026-03-09T00:00:00Z');
    expect(weekStartDateString(date, 'Europe/Prague')).toBe('2026-03-09');
  });
});

describe('currentTeamMondayDateString', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = currentTeamMondayDateString('Europe/Prague');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('scheduleAtNineAm', () => {
  it('produces a timestamp at 09:00 in the team timezone', () => {
    // Monday 2026-03-09 at 09:00 Europe/Prague is 08:00 UTC (winter, CET = UTC+1).
    const weekStart = new Date('2026-03-09T00:00:00Z');
    const result = scheduleAtNineAm(weekStart, 'Europe/Prague');
    const iso = result.toISOString();
    expect(iso).toBe('2026-03-09T08:00:00.000Z');
  });

  it('produces a 09:00 wall-clock time in the requested timezone', () => {
    // Using a date that resolves to the same calendar day in both UTC and LA
    // (15:00 UTC = 07:00/08:00 LA, depending on DST — same calendar day regardless).
    const weekStart = new Date('2026-03-09T15:00:00Z');
    const result = scheduleAtNineAm(weekStart, 'America/Los_Angeles');
    const laTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(result);
    expect(laTime).toBe('09:00');
  });
});
