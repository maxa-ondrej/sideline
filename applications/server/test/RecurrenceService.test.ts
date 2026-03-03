import { DateTime } from 'effect';
import { describe, expect, it } from 'vitest';
import { generateOccurrenceDates } from '~/services/RecurrenceService.js';

describe('generateOccurrenceDates', () => {
  it('generates correct dates for weekly over 4 weeks', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      dayOfWeek: 2, // Tuesday
      startDate: DateTime.unsafeMake('2026-03-03'), // Tuesday
      endDate: DateTime.unsafeMake('2026-03-31'),
    });
    expect(dates).toHaveLength(5);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-03',
      '2026-03-10',
      '2026-03-17',
      '2026-03-24',
      '2026-03-31',
    ]);
  });

  it('generates correct dates for biweekly (skips alternate weeks)', () => {
    const dates = generateOccurrenceDates({
      frequency: 'biweekly',
      dayOfWeek: 2, // Tuesday
      startDate: DateTime.unsafeMake('2026-03-03'), // Tuesday
      endDate: DateTime.unsafeMake('2026-03-31'),
    });
    expect(dates).toHaveLength(3);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-03',
      '2026-03-17',
      '2026-03-31',
    ]);
  });

  it('finds next occurrence when start date is not on target day', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      dayOfWeek: 4, // Thursday
      startDate: DateTime.unsafeMake('2026-03-02'), // Monday
      endDate: DateTime.unsafeMake('2026-03-15'),
    });
    expect(dates).toHaveLength(2);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual(['2026-03-05', '2026-03-12']);
  });

  it('returns empty when end is before start', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      dayOfWeek: 2,
      startDate: DateTime.unsafeMake('2026-04-01'),
      endDate: DateTime.unsafeMake('2026-03-01'),
    });
    expect(dates).toHaveLength(0);
  });

  it('generates single occurrence for exact one-week range', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
      startDate: DateTime.unsafeMake('2026-03-02'), // Monday
      endDate: DateTime.unsafeMake('2026-03-08'),
    });
    expect(dates).toHaveLength(1);
    expect(DateTime.formatIsoDateUtc(dates[0])).toBe('2026-03-02');
  });

  it('handles Sunday (day 0) correctly', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      dayOfWeek: 0, // Sunday
      startDate: DateTime.unsafeMake('2026-03-02'), // Monday
      endDate: DateTime.unsafeMake('2026-03-22'),
    });
    expect(dates).toHaveLength(3);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
    ]);
  });
});
