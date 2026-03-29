import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/channels/ensureMapping.js';

export const handleCreated = (event: ChannelRpcEvents.ChannelCreatedEvent) =>
  ensureMapping(event.team_id, event.group_id, event.guild_id, event.group_name).pipe(
    Effect.tap(({ discord_channel_id }) =>
      Effect.logInfo(
        `Synced channel_created: group ${event.group_id} → Discord channel ${discord_channel_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
