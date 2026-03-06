import type { EventRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Match } from 'effect';
import { POLL_BATCH_SIZE } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { handleCancelled } from './handleCancelled.js';
import { handleCreated } from './handleCreated.js';
import { handleRsvpReminder } from './handleRsvpReminder.js';
import { handleUpdated } from './handleUpdated.js';

const action = Match.type<EventRpcEvents.UnprocessedEventSyncEvent>().pipe(
  Match.tag('event_created', handleCreated),
  Match.tag('event_updated', handleUpdated),
  Match.tag('event_cancelled', handleCancelled),
  Match.tag('rsvp_reminder', handleRsvpReminder),
  Match.exhaustive,
);

const processEvent = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.map(
    ({ rpc, discord }) =>
      (event: EventRpcEvents.UnprocessedEventSyncEvent) =>
        action(event).pipe(
          Effect.flatMap(() => rpc['Event/MarkEventProcessed']({ id: event.id })),
          Effect.catchAll((error) =>
            rpc['Event/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
              Effect.tap(() =>
                Effect.logWarning(`Failed to process event sync event ${event.id}`, error),
              ),
            ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
        ),
  ),
);

export const ProcessorService = Effect.Do.pipe(
  Effect.tap(() => Effect.logDebug('EventSyncService initialized')),
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.bind('processEvent', ({ rpc, discord }) =>
    processEvent.pipe(
      Effect.provideService(SyncRpc, rpc),
      Effect.provideService(DiscordREST, discord),
    ),
  ),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc['Event/GetUnprocessedEvents']({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.tap((events) => Effect.logDebug(`Event sync poll: ${events.length} event(s)`)),
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(events.map(processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.log(`Processed ${events.length} event sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logWarning('Error polling event sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
