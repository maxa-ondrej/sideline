import type { ChannelRpcEvents, Discord } from '@sideline/domain';
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
  discordChannelId: Discord.Snowflake,
  discordRoleId: Option.Option<Discord.Snowflake>,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.tap(() => deleteRole(guildId, discordRoleId)),
    Effect.tap(({ rest }) => rest.deleteChannel(discordChannelId).pipe(Effect.retry(retryPolicy))),
    Effect.tap(() =>
      Effect.logInfo(`Deleted Discord channel ${discordChannelId} in guild ${guildId}`),
    ),
    Effect.asVoid,
  );

export const handleDeleted = (event: ChannelRpcEvents.GroupChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() =>
      deleteChannelAndRole(event.guild_id, event.discord_channel_id, event.discord_role_id),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.asVoid,
  );

export const handleRosterDeleted = (event: ChannelRpcEvents.RosterChannelDeletedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() =>
      deleteChannelAndRole(event.guild_id, event.discord_channel_id, event.discord_role_id),
    ),
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
  );
