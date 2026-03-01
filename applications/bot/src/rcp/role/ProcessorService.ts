import type { RoleRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Match } from 'effect';
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
          Effect.catchAll((error) =>
            rpc['Role/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
              Effect.tap(() =>
                Effect.logWarning(`Failed to process role sync event ${event.id}`, error),
              ),
            ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
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
  Effect.tap(() => Effect.logDebug('RoleSyncService initialized')),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc['Role/GetUnprocessedEvents']({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.tap((events) => Effect.logDebug(`Role sync poll: ${events.length} event(s)`)),
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(events.map(processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.log(`Processed ${events.length} role sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logWarning('Error polling role sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
