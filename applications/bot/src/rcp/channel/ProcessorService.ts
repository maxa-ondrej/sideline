import type { ChannelRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Match } from 'effect';
import { POLL_BATCH_SIZE } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { handleCreated } from './handleCreated.js';
import { handleDeleted } from './handleDeleted.js';
import { handleMemberAdded } from './handleMemberAdded.js';
import { handleMemberRemoved } from './handleMemberRemoved.js';

const action = Match.type<ChannelRpcEvents.UnprocessedChannelEvent>().pipe(
  Match.tag('channel_created', handleCreated),
  Match.tag('channel_deleted', handleDeleted),
  Match.tag('channel_member_added', handleMemberAdded),
  Match.tag('channel_member_removed', handleMemberRemoved),
  Match.exhaustive,
);

const processEvent = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.map(
    ({ rpc, discord }) =>
      (event: ChannelRpcEvents.UnprocessedChannelEvent) =>
        action(event).pipe(
          Effect.flatMap(() => rpc['Channel/MarkEventProcessed']({ id: event.id })),
          Effect.catchAll((error) =>
            rpc['Channel/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
              Effect.tap(() =>
                Effect.logWarning(`Failed to process channel sync event ${event.id}`, error),
              ),
            ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
        ),
  ),
);

export const ProcessorService = Effect.Do.pipe(
  Effect.tap(() => Effect.logDebug('ChannelSyncService initialized')),
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('discord', () => DiscordREST),
  Effect.bind('processEvent', ({ rpc, discord }) =>
    processEvent.pipe(
      Effect.provideService(SyncRpc, rpc),
      Effect.provideService(DiscordREST, discord),
    ),
  ),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc['Channel/GetUnprocessedEvents']({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.tap((events) => Effect.logDebug(`Channel sync poll: ${events.length} event(s)`)),
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(events.map(processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.log(`Processed ${events.length} channel sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logWarning('Error polling channel sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
