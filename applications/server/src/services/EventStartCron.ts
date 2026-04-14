import { Array, Effect, Schedule } from 'effect';
import { withCronMetrics } from '~/metrics.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';

export const eventStartCronEffect = Effect.Do.pipe(
  Effect.bind('eventsRepo', () => EventsRepository.asEffect()),
  Effect.bind('syncRepo', () => EventSyncEventsRepository.asEffect()),
  Effect.tap(() => Effect.logInfo('EventStartCron: starting cycle')),
  Effect.bind('events', ({ eventsRepo }) => eventsRepo.findEventsToStart()),
  Effect.tap(({ events, syncRepo, eventsRepo }) =>
    Effect.all(
      Array.map(events, (event) =>
        eventsRepo.startEvent(event.id).pipe(
          Effect.flatMap(() =>
            syncRepo
              .emitEventStarted(
                event.team_id,
                event.id,
                event.title,
                event.description,
                event.start_at,
                event.end_at,
                event.location,
                event.event_type,
              )
              .pipe(
                Effect.tap(() =>
                  Effect.logInfo(
                    `EventStartCron: marked event "${event.title}" (${event.id}) as started`,
                  ),
                ),
              ),
          ),
          Effect.catchTag('NoSuchElementError', () =>
            Effect.logDebug(
              `EventStartCron: event "${event.title}" (${event.id}) no longer active, skipping`,
            ),
          ),
        ),
      ),
      { concurrency: 1 },
    ),
  ),
  Effect.tap(({ events }) =>
    Effect.logInfo(`EventStartCron: cycle complete, ${String(events.length)} event(s) processed`),
  ),
  Effect.asVoid,
  withCronMetrics('event-start'),
);

const cronSchedule = Schedule.cron('* * * * *');

export const EventStartCron = eventStartCronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
