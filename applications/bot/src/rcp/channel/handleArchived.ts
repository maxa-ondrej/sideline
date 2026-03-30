import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { deleteChannelAndRole, deleteRole } from './channelUtils.js';

const deletePermissionOverwrite = (
  discordChannelId: Discord.Snowflake,
  discordRoleId: Option.Option<Discord.Snowflake>,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('roleId', () => discordRoleId),
    Effect.tap(({ rest, roleId }) =>
      rest
        .deleteChannelPermissionOverwrite(discordChannelId, roleId)
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(
        `Deleted permission overwrite for role ${roleId} on channel ${discordChannelId}`,
      ),
    ),
    Effect.catchTag('NoSuchElementException', () => Effect.void),
  );

const moveToArchive = (discordChannelId: Discord.Snowflake, archiveCategoryId: Discord.Snowflake) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.tap(({ rest }) =>
      rest
        .updateChannel(discordChannelId, { parent_id: archiveCategoryId })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Moved Discord channel ${discordChannelId} to archive category ${archiveCategoryId}`,
      ),
    ),
    Effect.asVoid,
  );

export const handleGroupArchived = (event: ChannelRpcEvents.GroupChannelArchivedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() =>
      moveToArchive(event.discord_channel_id, event.archive_category_id).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(
            `Failed to move group channel ${event.discord_channel_id} to archive, falling back to deletion`,
            error,
          ).pipe(
            Effect.tap(() =>
              deleteChannelAndRole(event.guild_id, event.discord_channel_id, event.discord_role_id),
            ),
          ),
        ),
        Effect.tap(() =>
          deletePermissionOverwrite(event.discord_channel_id, event.discord_role_id),
        ),
        Effect.tap(() => deleteRole(event.guild_id, event.discord_role_id)),
      ),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.asVoid,
  );

export const handleRosterArchived = (event: ChannelRpcEvents.RosterChannelArchivedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() =>
      moveToArchive(event.discord_channel_id, event.archive_category_id).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(
            `Failed to move roster channel ${event.discord_channel_id} to archive, falling back to deletion`,
            error,
          ).pipe(
            Effect.tap(() =>
              deleteChannelAndRole(event.guild_id, event.discord_channel_id, event.discord_role_id),
            ),
          ),
        ),
        Effect.tap(() =>
          deletePermissionOverwrite(event.discord_channel_id, event.discord_role_id),
        ),
        Effect.tap(() => deleteRole(event.guild_id, event.discord_role_id)),
      ),
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
