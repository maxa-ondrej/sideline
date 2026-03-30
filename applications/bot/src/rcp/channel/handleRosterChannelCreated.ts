import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { createDiscordChannelAndRole } from '~/rest/channels/createChannelWithRole.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleRosterChannelCreated = (event: ChannelRpcEvents.RosterChannelCreatedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('result', () => createDiscordChannelAndRole(event.guild_id, event.roster_name)),
    Effect.tap(({ result, rpc }) =>
      rpc['Channel/UpsertRosterMapping']({
        team_id: event.team_id,
        roster_id: event.roster_id,
        discord_channel_id: result.discord_channel_id,
        discord_role_id: result.discord_role_id,
      }),
    ),
    Effect.tap(({ result, rpc }) =>
      rpc['Channel/UpdateRosterChannel']({
        roster_id: event.roster_id,
        discord_channel_id: Option.some(result.discord_channel_id),
      }),
    ),
    Effect.tap(({ result }) =>
      Effect.logInfo(
        `Synced roster_channel_created: roster ${event.roster_id} → Discord channel ${result.discord_channel_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
