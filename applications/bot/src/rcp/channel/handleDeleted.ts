import type { ChannelRpcEvents, ChannelRpcModels, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

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

const deleteChannelAndRole = (
  guildId: Discord.Snowflake,
  mapping: ChannelRpcModels.ChannelMapping,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.tap(() => deleteRole(guildId, mapping.discord_role_id)),
    Effect.tap(({ rest }) =>
      rest.deleteChannel(mapping.discord_channel_id).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(`Deleted Discord channel ${mapping.discord_channel_id} in guild ${guildId}`),
    ),
    Effect.asVoid,
  );

export const handleDeleted = (event: ChannelRpcEvents.GroupChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ mapping }) => deleteChannelAndRole(event.guild_id, mapping)),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for group ${event.group_id} in guild ${event.guild_id}, skipping channel delete`,
      ),
    ),
  );

export const handleRosterDeleted = (event: ChannelRpcEvents.RosterChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ mapping }) => deleteChannelAndRole(event.guild_id, mapping)),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/UpdateRosterChannel']({
        roster_id: event.roster_id,
        discord_channel_id: Option.none(),
      }),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for roster ${event.roster_id} in guild ${event.guild_id}, skipping channel delete`,
      ),
    ),
  );
