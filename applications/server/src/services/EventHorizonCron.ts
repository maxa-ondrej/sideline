import { Array, DateTime, Effect, Option, Schedule } from 'effect';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { computeHorizonEnd, generateOccurrenceDates } from '~/services/RecurrenceService.js';

const cronEffect = Effect.Do.pipe(
  Effect.bind('seriesRepo', () => EventSeriesRepository),
  Effect.bind('eventsRepo', () => EventsRepository),
  Effect.tap(() => Effect.logInfo('EventHorizonCron: starting generation cycle')),
  Effect.bind('allSeries', ({ seriesRepo }) => seriesRepo.getActiveForGeneration()),
  Effect.tap(({ allSeries, seriesRepo, eventsRepo }) =>
    Effect.all(
      Array.map(allSeries, (s) => {
        const effectiveEnd = computeHorizonEnd({
          seriesEndDate: Option.getOrNull(s.end_date),
          horizonDays: s.event_horizon_days,
        });

        const startFrom = Option.match(s.last_generated_date, {
          onNone: () => s.start_date,
          onSome: (d) => DateTime.add(d, { days: 1 }),
        });

        if (DateTime.greaterThan(startFrom, effectiveEnd)) return Effect.void;

        const dates = generateOccurrenceDates({
          frequency: s.frequency,
          daysOfWeek: s.days_of_week,
          startDate: startFrom,
          endDate: effectiveEnd,
        });

        if (dates.length === 0) return Effect.void;

        return Effect.all(
          Array.map(dates, (date) => {
            const dateStr = DateTime.formatIsoDateUtc(date);
            const startAt = DateTime.unsafeMake(`${dateStr}T${s.start_time}Z`);
            const endAt = Option.map(s.end_time, (t) => DateTime.unsafeMake(`${dateStr}T${t}Z`));
            return eventsRepo.insertEvent({
              teamId: s.team_id,
              trainingTypeId: s.training_type_id,
              eventType: 'training',
              title: s.title,
              description: s.description,
              startAt,
              endAt,
              location: s.location,
              createdBy: s.created_by,
              seriesId: Option.some(s.id),
              discordTargetChannelId: s.discord_target_channel_id,
            });
          }),
          { concurrency: 1 },
        ).pipe(
          Effect.tap(() => seriesRepo.updateLastGeneratedDate(s.id, effectiveEnd)),
          Effect.tap(() =>
            Effect.logInfo(
              `EventHorizonCron: series ${s.id} — ${String(dates.length)} events generated`,
            ),
          ),
        );
      }),
    ),
  ),
  Effect.tap(() => Effect.logInfo('EventHorizonCron: generation cycle complete')),
  Effect.asVoid,
);

const cronSchedule = Schedule.cron('0 3 * * *');

export const EventHorizonCron = cronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
