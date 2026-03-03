import { DateTime } from 'effect';

export const generateOccurrenceDates = (params: {
  frequency: 'weekly' | 'biweekly';
  dayOfWeek: number;
  startDate: DateTime.Utc;
  endDate: DateTime.Utc;
}): ReadonlyArray<DateTime.Utc> => {
  const { frequency, dayOfWeek, startDate, endDate } = params;

  if (DateTime.greaterThan(startDate, endDate)) return [];

  const step = frequency === 'weekly' ? 7 : 14;
  const dates: DateTime.Utc[] = [];

  const currentDay = DateTime.getPartUtc(startDate, 'weekDay');
  let diff = dayOfWeek - currentDay;
  if (diff < 0) diff += 7;
  let current = DateTime.add(startDate, { days: diff });

  while (DateTime.lessThanOrEqualTo(current, endDate)) {
    dates.push(current);
    current = DateTime.add(current, { days: step });
  }

  return dates;
};
