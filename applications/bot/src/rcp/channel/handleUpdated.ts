import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

interface ChannelUpdatedFields {
  readonly guild_id: Discord.Snowflake;
  readonly discord_role_id: Discord.Snowflake;
  readonly discord_role_name: string;
  readonly discord_role_color: Option.Option<number>;
  readonly discord_channel_id: Discord.Snowflake;
  readonly discord_channel_name: string;
}

const handleChannelUpdated = (event: ChannelUpdatedFields) => {
  const roleColor = Option.match(event.discord_role_color, {
    onNone: () => 0,
    onSome: (c) => c,
  });
  return Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(({ rest }) =>
      rest
        .updateGuildRole(event.guild_id, event.discord_role_id, {
          name: event.discord_role_name,
          color: roleColor,
        })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Updated Discord role ${event.discord_role_id} name="${event.discord_role_name}" in guild ${event.guild_id}`,
      ),
    ),
    Effect.tap(({ rest }) =>
      rest
        .updateChannel(event.discord_channel_id, { name: event.discord_channel_name })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Updated Discord channel ${event.discord_channel_id} name="${event.discord_channel_name}" in guild ${event.guild_id}`,
      ),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Guild/UpdateChannelName']({
        channel_id: event.discord_channel_id,
        name: event.discord_channel_name,
      }),
    ),
    Effect.tap(() =>
      Effect.logInfo(`Synced channel name update for ${event.discord_channel_id} to server`),
    ),
    Effect.asVoid,
  );
};

export const handleGroupChannelUpdated = (event: ChannelRpcEvents.GroupChannelUpdatedEvent) =>
  handleChannelUpdated(event);

export const handleRosterChannelUpdated = (event: ChannelRpcEvents.RosterChannelUpdatedEvent) =>
  handleChannelUpdated(event);
