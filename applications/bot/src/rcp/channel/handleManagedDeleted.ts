import type { ChannelRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// NOTE: no delete endpoint currently emits `managed_channel_deleted` (v1); handler kept for future.
export const handleManagedDeleted = (event: ChannelRpcEvents.ManagedChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.tap(() =>
      Option.match(event.discord_channel_id, {
        onNone: () => Effect.void,
        onSome: (channelId) =>
          Effect.Do.pipe(
            Effect.bind('rest', () => DiscordREST.asEffect()),
            Effect.tap(({ rest }) => rest.deleteChannel(channelId).pipe(Effect.retry(retryPolicy))),
            Effect.tap(() =>
              Effect.logInfo(
                `Deleted managed Discord channel ${channelId} in guild ${event.guild_id}`,
              ),
            ),
            Effect.asVoid,
          ),
      }),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/ClearManagedChannel']({ team_channel_id: event.team_channel_id }),
    ),
    Effect.asVoid,
  );
