import { type Discord, GuildRpcGroup } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect } from 'effect';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';

export const GuildsRpcLive = Effect.Do.pipe(
  Effect.bind('botGuilds', () => BotGuildsRepository),
  Effect.bind('discordChannels', () => DiscordChannelsRepository),
  Effect.let(
    'Guild/RegisterGuild',
    ({ botGuilds }) =>
      ({
        guild_id,
        guild_name,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly guild_name: string;
      }) =>
        botGuilds
          .upsert(guild_id, guild_name)
          .pipe(Effect.catchAll((error) => Effect.logError('RegisterGuild failed', error))),
  ),
  Effect.let(
    'Guild/UnregisterGuild',
    ({ botGuilds }) =>
      ({ guild_id }: { readonly guild_id: Discord.Snowflake }) =>
        botGuilds
          .remove(guild_id)
          .pipe(Effect.catchAll((error) => Effect.logError('UnregisterGuild failed', error))),
  ),
  Effect.let(
    'Guild/IsGuildRegistered',
    ({ botGuilds }) =>
      ({ guild_id }: { readonly guild_id: Discord.Snowflake }) =>
        botGuilds.exists(guild_id).pipe(Effect.catchAll(() => Effect.succeed(false))),
  ),
  Effect.let(
    'Guild/SyncGuildChannels',
    ({ discordChannels }) =>
      ({
        guild_id,
        channels,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly channels: ReadonlyArray<{
          readonly channel_id: Discord.Snowflake;
          readonly name: string;
          readonly type: number;
          readonly parent_id: Discord.Snowflake | null;
        }>;
      }) =>
        discordChannels
          .syncChannels(guild_id, channels)
          .pipe(Effect.catchAll((error) => Effect.logError('SyncGuildChannels failed', error))),
  ),
  Bind.remove('botGuilds'),
  Bind.remove('discordChannels'),
  (handlers) => GuildRpcGroup.GuildRpcGroup.toLayer(handlers),
);
