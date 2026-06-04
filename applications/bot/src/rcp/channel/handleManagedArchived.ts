import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const moveToArchive = (discordChannelId: Discord.Snowflake, archiveCategoryId: Discord.Snowflake) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.tap(({ rest }) =>
      rest
        .updateChannel(discordChannelId, { parent_id: archiveCategoryId })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Moved managed Discord channel ${discordChannelId} to archive category ${archiveCategoryId}`,
      ),
    ),
    Effect.asVoid,
  );

const deleteChannelFallback = (discordChannelId: Discord.Snowflake) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.tap(({ rest }) => rest.deleteChannel(discordChannelId).pipe(Effect.retry(retryPolicy))),
    Effect.tap(() =>
      Effect.logInfo(`Deleted managed Discord channel ${discordChannelId} as archive fallback`),
    ),
    Effect.asVoid,
  );

export const handleManagedArchived = (event: ChannelRpcEvents.ManagedChannelArchivedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.tap(() =>
      Option.match(event.discord_channel_id, {
        onNone: () => Effect.void,
        onSome: (channelId) =>
          moveToArchive(channelId, event.archive_category_id).pipe(
            Effect.catch((error) =>
              Effect.logWarning(
                `Failed to move managed channel ${channelId} to archive, falling back to deletion`,
                error,
              ).pipe(Effect.tap(() => deleteChannelFallback(channelId))),
            ),
          ),
      }),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/ClearManagedChannel']({ team_channel_id: event.team_channel_id }),
    ),
    Effect.asVoid,
  );
