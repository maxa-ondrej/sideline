import { Effect, Option, Schedule } from 'effect';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';

const cronEffect = Effect.Do.pipe(
  Effect.bind('settingsRepo', () => TeamSettingsRepository),
  Effect.bind('eventsRepo', () => EventsRepository),
  Effect.bind('syncRepo', () => EventSyncEventsRepository),
  Effect.tap(() => Effect.logInfo('RsvpReminderCron: starting reminder cycle')),
  Effect.bind('events', ({ settingsRepo }) => settingsRepo.findEventsNeedingReminder()),
  Effect.tap(({ events, syncRepo, eventsRepo }) =>
    Effect.all(
      events.map((event) =>
        syncRepo
          .emitRsvpReminder(
            event.team_id,
            event.event_id,
            event.title,
            Option.none(),
            event.start_at,
            Option.none(),
            Option.none(),
            event.event_type,
            event.discord_target_channel_id,
          )
          .pipe(
            Effect.tap(() => eventsRepo.markReminderSent(event.event_id)),
            Effect.tap(() =>
              Effect.logInfo(
                `RsvpReminderCron: queued reminder for event "${event.title}" (${event.event_id})`,
              ),
            ),
          ),
      ),
      { concurrency: 1 },
    ),
  ),
  Effect.tap(({ events }) =>
    Effect.logInfo(`RsvpReminderCron: cycle complete, ${String(events.length)} event(s) processed`),
  ),
  Effect.asVoid,
);

const cronSchedule = Schedule.cron('* * * * *');

export const RsvpReminderCron = cronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
