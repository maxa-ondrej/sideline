import { DateTime } from 'effect';
import { describe, expect, it } from 'vitest';
import { generateOccurrenceDates } from '~/services/RecurrenceService.js';

describe('generateOccurrenceDates', () => {
  it('generates correct dates for weekly over 4 weeks', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      daysOfWeek: [2], // Tuesday
      startDate: DateTime.makeUnsafe('2026-03-03'), // Tuesday
      endDate: DateTime.makeUnsafe('2026-03-31'),
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
      daysOfWeek: [2], // Tuesday
      startDate: DateTime.makeUnsafe('2026-03-03'), // Tuesday
      endDate: DateTime.makeUnsafe('2026-03-31'),
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
      daysOfWeek: [4], // Thursday
      startDate: DateTime.makeUnsafe('2026-03-02'), // Monday
      endDate: DateTime.makeUnsafe('2026-03-15'),
    });
    expect(dates).toHaveLength(2);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual(['2026-03-05', '2026-03-12']);
  });

  it('returns empty when end is before start', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      daysOfWeek: [2],
      startDate: DateTime.makeUnsafe('2026-04-01'),
      endDate: DateTime.makeUnsafe('2026-03-01'),
    });
    expect(dates).toHaveLength(0);
  });

  it('generates single occurrence for exact one-week range', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      daysOfWeek: [1], // Monday
      startDate: DateTime.makeUnsafe('2026-03-02'), // Monday
      endDate: DateTime.makeUnsafe('2026-03-08'),
    });
    expect(dates).toHaveLength(1);
    expect(DateTime.formatIsoDateUtc(dates[0])).toBe('2026-03-02');
  });

  it('handles Sunday (day 0) correctly', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      daysOfWeek: [0], // Sunday
      startDate: DateTime.makeUnsafe('2026-03-02'), // Monday
      endDate: DateTime.makeUnsafe('2026-03-22'),
    });
    expect(dates).toHaveLength(3);
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
    ]);
  });

  it('generates dates for multiple days weekly', () => {
    const dates = generateOccurrenceDates({
      frequency: 'weekly',
      daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
      startDate: DateTime.makeUnsafe('2026-03-02'), // Monday
      endDate: DateTime.makeUnsafe('2026-03-13'), // Friday
    });
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-02', // Mon
      '2026-03-04', // Wed
      '2026-03-06', // Fri
      '2026-03-09', // Mon
      '2026-03-11', // Wed
      '2026-03-13', // Fri
    ]);
  });

  it('generates dates for multiple days biweekly', () => {
    const dates = generateOccurrenceDates({
      frequency: 'biweekly',
      daysOfWeek: [1, 3], // Monday, Wednesday
      startDate: DateTime.makeUnsafe('2026-03-02'), // Monday
      endDate: DateTime.makeUnsafe('2026-03-25'),
    });
    // Week 0 (Mar 2-8): Mon 2, Wed 4
    // Week 1 (Mar 9-15): skipped
    // Week 2 (Mar 16-22): Mon 16, Wed 18
    // Week 3 (Mar 23-25): skipped
    expect(dates.map(DateTime.formatIsoDateUtc)).toEqual([
      '2026-03-02',
      '2026-03-04',
      '2026-03-16',
      '2026-03-18',
    ]);
  });
});
