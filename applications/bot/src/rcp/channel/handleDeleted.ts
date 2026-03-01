import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, type Option } from 'effect';
import { SyncRpc } from '~/index.js';
import { retryPolicy } from '~/rest/utils.js';

const deleteRole = (guildId: Discord.Snowflake, roleId: Option.Option<Discord.Snowflake>) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('roleId', () => roleId),
    Effect.tap(({ rest, roleId }) =>
      rest.deleteGuildRole(guildId, roleId).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(`Deleted Discord role ${roleId} in guild ${guildId}`),
    ),
    Effect.catchTag('NoSuchElementException', () => Effect.void),
  );

export const handleDeleted = (event: ChannelRpcEvents.ChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({
        team_id: event.team_id,
        subgroup_id: event.subgroup_id,
      }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tapErrorTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for subgroup ${event.subgroup_id} in guild ${event.guild_id}, skipping delete`,
      ),
    ),
    Effect.tap(({ mapping }) => deleteRole(event.guild_id, mapping.discord_role_id)),
    Effect.tap(({ rest, mapping }) =>
      rest.deleteChannel(mapping.discord_channel_id).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ mapping }) =>
      Effect.log(
        `Deleted Discord channel ${mapping.discord_channel_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteMapping']({
        team_id: event.team_id,
        subgroup_id: event.subgroup_id,
      }),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () => Effect.void),
  );
