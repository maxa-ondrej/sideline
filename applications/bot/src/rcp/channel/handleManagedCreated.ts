import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect } from 'effect';
import { createChannelOnly } from '~/rest/channels/createChannelOnly.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleManagedCreated = (event: ChannelRpcEvents.ManagedChannelCreatedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('channelResult', () =>
      createChannelOnly(event.guild_id, event.discord_channel_name),
    ),
    Effect.tap(({ rpc, channelResult }) =>
      rpc['Channel/UpsertManagedChannel']({
        team_channel_id: event.team_channel_id,
        discord_channel_id: channelResult.discord_channel_id,
      }),
    ),
    Effect.tap(({ channelResult }) =>
      Effect.logInfo(
        `Synced managed_channel_created: team_channel ${event.team_channel_id} → Discord channel ${channelResult.discord_channel_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
