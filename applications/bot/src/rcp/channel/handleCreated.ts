import type { ChannelRpcEvents, Discord as DiscordSchemas } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { createRoleForChannel } from '~/rest/channels/createRoleForChannel.js';
import { ensureMapping } from '~/rest/channels/ensureMapping.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleCreated = (event: ChannelRpcEvents.GroupChannelCreatedEvent) =>
  Option.match(event.existing_channel_id, {
    onSome: (channelId) =>
      Effect.Do.pipe(
        Effect.bind('rpc', () => SyncRpc),
        Effect.bind('result', () =>
          createRoleForChannel(event.guild_id, channelId, event.group_name),
        ),
        Effect.tap(({ result, rpc }) =>
          rpc['Channel/UpsertMapping']({
            team_id: event.team_id,
            group_id: event.group_id,
            discord_channel_id: result.discord_channel_id as DiscordSchemas.Snowflake,
            discord_role_id: result.discord_role_id as DiscordSchemas.Snowflake,
          }),
        ),
        Effect.tap(({ result }) =>
          Effect.logInfo(
            `Synced group_channel_created (link): group ${event.group_id} → Discord channel ${result.discord_channel_id} in guild ${event.guild_id}`,
          ),
        ),
        Effect.asVoid,
      ),
    onNone: () =>
      ensureMapping(event.team_id, event.group_id, event.guild_id, event.group_name).pipe(
        Effect.tap(({ discord_channel_id }) =>
          Effect.logInfo(
            `Synced group_channel_created (new): group ${event.group_id} → Discord channel ${discord_channel_id} in guild ${event.guild_id}`,
          ),
        ),
        Effect.asVoid,
      ),
  });
