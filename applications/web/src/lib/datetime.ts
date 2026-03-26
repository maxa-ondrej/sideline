import { DateTime } from 'effect';

/**
 * Interpret a date + time string pair in the browser's local timezone
 * and return a UTC DateTime.
 */
export const localToUtc = (date: string, time: string): DateTime.Utc => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return DateTime.unsafeFromDate(new Date(y, mo - 1, d, h, mi, 0, 0));
};

/** Format a UTC DateTime as YYYY-MM-DD in the browser's local timezone. */
export const formatLocalDate = (dt: DateTime.Utc): string => {
  const d = new Date(Number(DateTime.toEpochMillis(dt)));
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
};

/**
 * Convert a date-only string (YYYY-MM-DD) to a UTC DateTime anchored at noon.
 * Using noon ensures the UTC calendar date matches the intended date for all
 * practical timezones (UTC-12 to UTC+12).
 */
export const dateOnlyToUtc = (date: string): DateTime.Utc =>
  DateTime.unsafeMake(`${date}T12:00:00Z`);

/** Format a UTC DateTime as HH:mm in the browser's local timezone. */
export const formatLocalTime = (dt: DateTime.Utc): string => {
  const d = new Date(Number(DateTime.toEpochMillis(dt)));
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${mi}`;
};
