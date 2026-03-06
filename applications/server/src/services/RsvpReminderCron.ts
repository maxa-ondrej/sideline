import { Effect, Schedule } from 'effect';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';

const cronEffect = Effect.Do.pipe(
  Effect.bind('settingsRepo', () => TeamSettingsRepository),
  Effect.bind('eventsRepo', () => EventsRepository),
  Effect.bind('syncRepo', () => EventSyncEventsRepository),
  Effect.tap(() => Effect.logInfo('RsvpReminderCron: starting reminder cycle')),
  Effect.bind('events', ({ settingsRepo }) =>
    settingsRepo.findEventsNeedingReminder().pipe(
      Effect.tapError((e) => Effect.logWarning('RsvpReminderCron: failed to find events', e)),
      Effect.catchAll(() => Effect.succeed([] as const)),
    ),
  ),
  Effect.tap(({ events, syncRepo, eventsRepo }) =>
    Effect.all(
      events.map((event) =>
        syncRepo
          .emitIfGuildLinked(
            event.team_id,
            'rsvp_reminder',
            event.event_id,
            event.title,
            null,
            event.start_at,
            null,
            null,
            event.event_type,
            event.discord_target_channel_id ?? undefined,
          )
          .pipe(
            Effect.tap(() => eventsRepo.markReminderSent(event.event_id)),
            Effect.tap(() =>
              Effect.logInfo(
                `RsvpReminderCron: queued reminder for event "${event.title}" (${event.event_id})`,
              ),
            ),
            Effect.tapError((e) =>
              Effect.logWarning(`RsvpReminderCron: failed for event ${event.event_id}`, e),
            ),
            Effect.catchAll(() => Effect.void),
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

const cronSchedule = Schedule.cron('0 * * * *');

export const RsvpReminderCron = cronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
