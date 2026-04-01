import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';

interface ChannelUpdatedFields {
  readonly guild_id: Discord.Snowflake;
  readonly discord_role_id: Discord.Snowflake;
  readonly discord_role_name: string;
  readonly discord_role_color: Option.Option<number>;
  readonly discord_channel_id: Discord.Snowflake;
  readonly discord_channel_name: string;
}

const handleChannelUpdated = (event: ChannelUpdatedFields) => {
  const roleColor = Option.getOrUndefined(event.discord_role_color);
  return Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.tap(({ rest }) =>
      Effect.all(
        [
          rest
            .updateGuildRole(event.guild_id, event.discord_role_id, {
              name: event.discord_role_name,
              color: roleColor,
            })
            .pipe(
              Effect.retry(retryPolicy),
              Effect.tap(() =>
                Effect.logInfo(
                  `Updated Discord role ${event.discord_role_id} name="${event.discord_role_name}" in guild ${event.guild_id}`,
                ),
              ),
            ),
          rest.updateChannel(event.discord_channel_id, { name: event.discord_channel_name }).pipe(
            Effect.retry(retryPolicy),
            Effect.tap(() =>
              Effect.logInfo(
                `Updated Discord channel ${event.discord_channel_id} name="${event.discord_channel_name}" in guild ${event.guild_id}`,
              ),
            ),
          ),
        ],
        { concurrency: 2 },
      ),
    ),
    Effect.asVoid,
  );
};

export const handleGroupChannelUpdated = (event: ChannelRpcEvents.GroupChannelUpdatedEvent) =>
  handleChannelUpdated(event);

export const handleRosterChannelUpdated = (event: ChannelRpcEvents.RosterChannelUpdatedEvent) =>
  handleChannelUpdated(event);
