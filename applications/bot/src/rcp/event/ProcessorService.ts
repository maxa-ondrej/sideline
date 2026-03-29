import type { EventRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array, Effect, Match, Metric, pipe } from 'effect';
import { syncEventsFailedTotal, syncEventsProcessedTotal } from '~/metrics.js';
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
          Effect.tap(() =>
            Metric.update(
              pipe(
                syncEventsProcessedTotal,
                Metric.tagged('sync_type', 'event'),
                Metric.tagged('action', event._tag),
              ),
              1,
            ),
          ),
          Effect.catchTag(
            'RpcClientError',
            'RequestError',
            'ResponseError',
            'RatelimitedResponse',
            'ErrorResponse',
            (error) =>
              rpc['Event/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
                Effect.tap(() =>
                  Effect.logWarning(`Failed to process event sync event ${event.id}`, error),
                ),
                Effect.tap(() =>
                  Metric.update(
                    pipe(syncEventsFailedTotal, Metric.tagged('sync_type', 'event')),
                    1,
                  ),
                ),
              ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
          Effect.withSpan(`sync/event/${event._tag}`, {
            attributes: { 'event.id': String(event.id) },
          }),
        ),
  ),
);

export const ProcessorService = Effect.Do.pipe(
  Effect.tap(() => Effect.logInfo('EventSyncService initialized')),
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
          : Effect.all(Array.map(events, processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.logInfo(`Processed ${events.length} event sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logError('Error polling event sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
