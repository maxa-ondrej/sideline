import { WeeklySummary } from '@sideline/domain';
import { DateTime } from 'effect';

/**
 * Returns the Monday 00:00 of the current ISO week in the given team timezone,
 * as a Date object.
 */
export const currentTeamMondayDate = (teamTz: string): Date => {
  const now = DateTime.nowUnsafe();
  const weekRange = WeeklySummary.weekRangeFor(now, teamTz);
  return new Date(weekRange.startAt.epochMilliseconds);
};

/**
 * Formats a Date as 'YYYY-MM-DD' in the given IANA timezone.
 */
export const formatDateInTz = (date: Date, timezone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

/**
 * Returns the Monday date string (YYYY-MM-DD) of the current ISO week in the
 * given team timezone.
 */
export const currentTeamMondayDateString = (teamTz: string): string => {
  const monday = currentTeamMondayDate(teamTz);
  return formatDateInTz(monday, teamTz);
};

/**
 * Given a week_start_date (as stored in DB, UTC midnight) and a team timezone,
 * returns the date string as it would appear in the team's local timezone.
 */
export const weekStartDateString = (date: Date, teamTz: string): string =>
  formatDateInTz(date, teamTz);

/**
 * Combines a week_start_date (Date at UTC midnight) with 09:00 in the given
 * team timezone to produce a UTC timestamp for the announcement.
 */
export const scheduleAtNineAm = (weekStart: Date, teamTz: string): Date => {
  const dateStr = formatDateInTz(weekStart, teamTz);
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  const tz = DateTime.zoneMakeNamedUnsafe(teamTz);
  const utcAtNoon = DateTime.makeUnsafe(Date.UTC(year, month - 1, day, 12, 0, 0));
  const zoned = DateTime.setZone(utcAtNoon, tz);
  const at9am = DateTime.setParts(zoned, { hour: 9, minute: 0, second: 0, millisecond: 0 });
  return new Date(at9am.epochMilliseconds);
};
