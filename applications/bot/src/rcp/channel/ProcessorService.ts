import type { ChannelRpcEvents } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array, Effect, Match, Metric, pipe } from 'effect';
import { syncEventsFailedTotal, syncEventsProcessedTotal } from '~/metrics.js';
import { POLL_BATCH_SIZE } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { handleCreated } from './handleCreated.js';
import { handleDeleted, handleRosterDeleted } from './handleDeleted.js';
import { handleMemberAdded, handleRosterMemberAdded } from './handleMemberAdded.js';
import { handleMemberRemoved, handleRosterMemberRemoved } from './handleMemberRemoved.js';
import { handleRosterChannelCreated } from './handleRosterChannelCreated.js';

const action = Match.type<ChannelRpcEvents.UnprocessedChannelEvent>().pipe(
  Match.tag('group_channel_created', handleCreated),
  Match.tag('roster_channel_created', handleRosterChannelCreated),
  Match.tag('group_channel_deleted', handleDeleted),
  Match.tag('roster_channel_deleted', handleRosterDeleted),
  Match.tag('group_member_added', handleMemberAdded),
  Match.tag('roster_member_added', handleRosterMemberAdded),
  Match.tag('group_member_removed', handleMemberRemoved),
  Match.tag('roster_member_removed', handleRosterMemberRemoved),
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
          Effect.tap(() =>
            Metric.update(
              pipe(
                syncEventsProcessedTotal,
                Metric.tagged('sync_type', 'channel'),
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
              rpc['Channel/MarkEventFailed']({ id: event.id, error: String(error) }).pipe(
                Effect.tap(() =>
                  Effect.logWarning(`Failed to process channel sync event ${event.id}`, error),
                ),
                Effect.tap(() =>
                  Metric.update(
                    pipe(syncEventsFailedTotal, Metric.tagged('sync_type', 'channel')),
                    1,
                  ),
                ),
              ),
          ),
          Effect.provideService(SyncRpc, rpc),
          Effect.provideService(DiscordREST, discord),
          Effect.withSpan(`sync/channel/${event._tag}`, {
            attributes: { 'event.id': String(event.id) },
          }),
        ),
  ),
);

export const ProcessorService = Effect.Do.pipe(
  Effect.tap(() => Effect.logInfo('ChannelSyncService initialized')),
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
          : Effect.all(Array.map(events, processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.logInfo(`Processed ${events.length} channel sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.tapError((error) => Effect.logError('Error polling channel sync events', error)),
    ),
  ),
  Bind.remove('rpc'),
  Bind.remove('processEvent'),
);
