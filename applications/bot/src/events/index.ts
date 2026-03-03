import { Discord } from '@sideline/domain';
import { DiscordGateway } from 'dfx/gateway';
import * as DiscordTypes from 'dfx/types';
import { Effect, Schema } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeSync(Discord.Snowflake);

export const eventHandlers = Effect.Do.pipe(
  Effect.bind('gateway', () => DiscordGateway),
  Effect.bind('rpc', () => SyncRpc),
  Effect.let('guildCreate', ({ gateway, rpc }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildCreate, (guild) =>
      Effect.Do.pipe(
        Effect.tap(() => Effect.log(`Guild available: ${guild.name} (${guild.id})`)),
        Effect.tap(() =>
          rpc['Guild/RegisterGuild']({
            guild_id: decodeSnowflake(guild.id),
            guild_name: guild.name,
          }),
        ),
        Effect.catchAll((error) => Effect.logError(`Failed to register guild ${guild.id}`, error)),
      ),
    ),
  ),
  Effect.let('guildDelete', ({ gateway, rpc }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildDelete, (guild) =>
      guild.unavailable
        ? Effect.log(`Guild unavailable (outage): ${guild.id}`)
        : Effect.Do.pipe(
            Effect.tap(() => Effect.log(`Guild removed: ${guild.id}`)),
            Effect.tap(() =>
              rpc['Guild/UnregisterGuild']({
                guild_id: decodeSnowflake(guild.id),
              }),
            ),
            Effect.catchAll((error) =>
              Effect.logError(`Failed to unregister guild ${guild.id}`, error),
            ),
          ),
    ),
  ),
  Effect.let('guildMemberAdd', ({ gateway }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberAdd, (member) =>
      Effect.log(
        `Member joined: ${member.user?.username ?? 'unknown'} in guild ${member.guild_id}`,
      ),
    ),
  ),
  Effect.let('guildMemberRemove', ({ gateway }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberRemove, (member) =>
      Effect.log(`Member left: ${member.user.username} from guild ${member.guild_id}`),
    ),
  ),
  Effect.let('guildMemberUpdate', ({ gateway }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberUpdate, (member) =>
      Effect.log(`Member updated: ${member.user.username} in guild ${member.guild_id}`),
    ),
  ),
  Effect.map(
    ({ guildCreate, guildDelete, guildMemberAdd, guildMemberRemove, guildMemberUpdate }) => [
      guildCreate,
      guildDelete,
      guildMemberAdd,
      guildMemberRemove,
      guildMemberUpdate,
    ],
  ),
);
