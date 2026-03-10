import { DateTime } from 'effect';

export const computeHorizonEnd = (params: {
  seriesEndDate: DateTime.Utc | null;
  horizonDays: number;
}): DateTime.Utc => {
  const horizonEnd = DateTime.add(DateTime.unsafeNow(), { days: params.horizonDays });
  if (params.seriesEndDate === null) return horizonEnd;
  return DateTime.lessThanOrEqualTo(params.seriesEndDate, horizonEnd)
    ? params.seriesEndDate
    : horizonEnd;
};

export const generateOccurrenceDates = (params: {
  frequency: 'weekly' | 'biweekly';
  daysOfWeek: ReadonlyArray<number>;
  startDate: DateTime.Utc;
  endDate: DateTime.Utc;
}): ReadonlyArray<DateTime.Utc> => {
  const { frequency, daysOfWeek, startDate, endDate } = params;

  if (DateTime.greaterThan(startDate, endDate)) return [];
  if (daysOfWeek.length === 0) return [];

  const daySet = new Set(daysOfWeek);
  const dates: DateTime.Utc[] = [];

  let current = startDate;

  // For biweekly, track which week number we're in relative to start
  const startDayNumber = Math.floor(DateTime.toEpochMillis(startDate) / (1000 * 60 * 60 * 24));

  while (DateTime.lessThanOrEqualTo(current, endDate)) {
    const currentDay = DateTime.getPartUtc(current, 'weekDay');

    if (daySet.has(currentDay)) {
      if (frequency === 'weekly') {
        dates.push(current);
      } else {
        // biweekly: only include days in even weeks (0, 2, 4, ...)
        const currentDayNumber = Math.floor(
          DateTime.toEpochMillis(current) / (1000 * 60 * 60 * 24),
        );
        const daysSinceStart = currentDayNumber - startDayNumber;
        const weekNumber = Math.floor(daysSinceStart / 7);
        if (weekNumber % 2 === 0) {
          dates.push(current);
        }
      }
    }

    current = DateTime.add(current, { days: 1 });
  }

  return dates;
};
