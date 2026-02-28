import type { ChannelRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/channels/ensureMapping.js';
import { retryPolicy } from '~/rest/utils.js';

export const handleMemberAdded = (event: ChannelRpcEvents.ChannelMemberAddedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('mapping', () =>
      ensureMapping(event.team_id, event.subgroup_id, event.guild_id, event.subgroup_name),
    ),
    Effect.bind('guildRole', ({ rest, mapping }) =>
      rest
        .addGuildMemberRole(event.guild_id, event.discord_user_id, mapping.discord_role_id)
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ mapping }) =>
      Effect.log(
        `Assigned role ${mapping.discord_role_id} to user ${event.discord_user_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
