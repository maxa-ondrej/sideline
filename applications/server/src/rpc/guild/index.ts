import { type Discord, GuildRpcGroup } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect } from 'effect';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';

export const GuildsRpcLive = Effect.Do.pipe(
  Effect.bind('botGuilds', () => BotGuildsRepository),
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
  Bind.remove('botGuilds'),
  (handlers) => GuildRpcGroup.GuildRpcGroup.toLayer(handlers),
);
