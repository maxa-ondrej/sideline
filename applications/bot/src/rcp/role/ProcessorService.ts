import type { RoleRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array, Effect, Match, Metric, pipe } from 'effect';
import { syncEventsFailedTotal, syncEventsProcessedTotal } from '../../metrics.js';
import { POLL_BATCH_SIZE } from '../../rest/utils.js';
import { SyncRpc } from '../../services/SyncRpc.js';
import { handleMemberAdded } from './handleAssigned.js';
import { handleCreated } from './handleCreated.js';
import { handleDeleted } from './handleDeleted.js';
import { handleMemberRemoved } from './handleUnassigned.js';

const action = Match.type<RoleRpcEvents.UnprocessedRoleEvent>().pipe(
  Match.tag('role_created', handleCreated),
  Match.tag('role_deleted', handleDeleted),
  Match.tag('role_assigned', handleMemberAdded),
  Match.tag('role_unassigned', handleMemberRemoved),
  Match.exhaustive,
);

const processEvent = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.map(
    ({ rpc, discord }) =>
      (event: RoleRpcEvents.UnprocessedRoleEvent) =>
        action(event).pipe(
          Effect.flatMap(() => rpc['Role/MarkEventProcessed']({ id: event.id })),
          Effect.tap(() =>
            Metric.update(
              pipe(
                syncEventsProcessedTotal,
                Metric.tagged('sync_type', 'role'),
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
              rpc['Role/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
                Effect.tap(() =>
                  Effect.logWarning(`Failed to process role sync event ${event.id}`, error),
                ),
                Effect.tap(() =>
                  Metric.update(pipe(syncEventsFailedTotal, Metric.tagged('sync_type', 'role')), 1),
                ),
              ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
          Effect.withSpan(`sync/role/${event._tag}`, {
            attributes: { 'event.id': String(event.id) },
          }),
        ),
  ),
);

export const ProcessorService = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.bind('processEvent', ({ rpc, discord }) =>
    processEvent.pipe(
      Effect.provideService(SyncRpc, rpc),
      Effect.provideService(DiscordREST, discord),
    ),
  ),
  Effect.tap(() => Effect.logInfo('RoleSyncService initialized')),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc['Role/GetUnprocessedEvents']({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.tap((events) => Effect.logDebug(`Role sync poll: ${events.length} event(s)`)),
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(Array.map(events, processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.logInfo(`Processed ${events.length} role sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logError('Error polling role sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
