import { describe, expect, it } from '@effect/vitest';
import { getWeekdayHeaders } from '~/lib/calendar-utils.js';

describe('getWeekdayHeaders', () => {
  it('returns 7 items', () => {
    const headers = getWeekdayHeaders('en');
    expect(headers).toHaveLength(7);
  });

  it('starts from Monday when locale is "en"', () => {
    const headers = getWeekdayHeaders('en');
    // The first day should be Monday — check it contains "Mon" in English short form
    expect(headers[0].toLowerCase()).toMatch(/^mon/);
  });

  it('returns English weekday names for "en" locale', () => {
    const headers = getWeekdayHeaders('en');
    // English short weekday names starting from Monday
    const expected = ['Mon', 'Tue', 'Wed', 'Thu', 'fri', 'Sat', 'Sun'].map((d) => d.toLowerCase());
    headers.forEach((h) => {
      expect(expected.some((e) => h.toLowerCase().startsWith(e.slice(0, 2)))).toBe(true);
    });
  });

  it('returns Czech weekday names for "cs" locale', () => {
    const headers = getWeekdayHeaders('cs');
    // Czech short weekday names starting from Monday: po, út, st, čt, pá, so, ne
    // Czech short weekday prefixes: po, út, st, čt, pá, so, ne
    // At least verify the first header starts with "po" (pondělí = Monday in Czech)
    expect(headers[0].toLowerCase().startsWith('po')).toBe(true);
    expect(headers).toHaveLength(7);
  });

  it('returns 7 items starting from Monday with "cs" locale', () => {
    const headers = getWeekdayHeaders('cs');
    expect(headers).toHaveLength(7);
    // Monday in Czech short form is "po"
    expect(headers[0].toLowerCase().startsWith('po')).toBe(true);
  });

  it('returns 7 items when no locale is provided', () => {
    const headers = getWeekdayHeaders();
    expect(headers).toHaveLength(7);
  });
});
