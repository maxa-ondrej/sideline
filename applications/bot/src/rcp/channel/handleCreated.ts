import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/channels/ensureMapping.js';

export const handleCreated = (event: ChannelRpcEvents.ChannelCreatedEvent) =>
  ensureMapping(event.team_id, event.subgroup_id, event.guild_id, event.subgroup_name).pipe(
    Effect.tap(({ discord_channel_id }) =>
      Effect.log(
        `Synced channel_created: subgroup ${event.subgroup_id} → Discord channel ${discord_channel_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
