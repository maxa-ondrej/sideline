import { DiscordGateway } from 'dfx/gateway';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';

export const eventHandlers = Effect.Do.pipe(
  Effect.bind('gateway', () => DiscordGateway),
  Effect.let('guildCreate', ({ gateway }) =>
    gateway.handleDispatch(Discord.GatewayDispatchEvents.GuildCreate, (guild) =>
      Effect.log(`Guild available: ${guild.name} (${guild.id})`),
    ),
  ),
  Effect.let('guildMemberAdd', ({ gateway }) =>
    gateway.handleDispatch(Discord.GatewayDispatchEvents.GuildMemberAdd, (member) =>
      Effect.log(
        `Member joined: ${member.user?.username ?? 'unknown'} in guild ${member.guild_id}`,
      ),
    ),
  ),
  Effect.let('guildMemberRemove', ({ gateway }) =>
    gateway.handleDispatch(Discord.GatewayDispatchEvents.GuildMemberRemove, (member) =>
      Effect.log(`Member left: ${member.user.username} from guild ${member.guild_id}`),
    ),
  ),
  Effect.let('guildMemberUpdate', ({ gateway }) =>
    gateway.handleDispatch(Discord.GatewayDispatchEvents.GuildMemberUpdate, (member) =>
      Effect.log(`Member updated: ${member.user.username} in guild ${member.guild_id}`),
    ),
  ),
  Effect.map(({ guildCreate, guildMemberAdd, guildMemberRemove, guildMemberUpdate }) => [
    guildCreate,
    guildMemberAdd,
    guildMemberRemove,
    guildMemberUpdate,
  ]),
);
