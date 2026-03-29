import { Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { DiscordGateway } from 'dfx/gateway';
import * as DiscordTypes from 'dfx/types';
import { Array as Arr, Effect, Option, Schema } from 'effect';
import { DfxGuildMember, DfxTextChannel, DfxUser } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeSync(Discord.Snowflake);
const decodeTextChannel = Schema.decodeUnknownOption(DfxTextChannel);
const decodeGuildMember = Schema.decodeUnknownOption(DfxGuildMember);
const decodeUser = Schema.decodeUnknownSync(DfxUser);

export const eventHandlers = Effect.Do.pipe(
  Effect.bind('gateway', () => DiscordGateway),
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('rest', () => DiscordREST),
  Effect.let('guildCreate', ({ gateway, rpc, rest }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildCreate, (guild) =>
      Effect.Do.pipe(
        Effect.tap(() => Effect.logInfo(`Guild available: ${guild.name} (${guild.id})`)),
        Effect.tap(() =>
          rpc['Guild/RegisterGuild']({
            guild_id: decodeSnowflake(guild.id),
            guild_name: guild.name,
          }),
        ),
        Effect.tap(() =>
          rest.listGuildChannels(guild.id).pipe(
            Effect.map((channels) =>
              Arr.filterMap(channels, (ch) =>
                decodeTextChannel(ch).pipe(
                  Option.map((decoded) => ({
                    channel_id: decoded.id,
                    name: decoded.name,
                    type: decoded.type,
                    parent_id: decoded.parent_id,
                  })),
                ),
              ),
            ),
            Effect.tap((channels) =>
              rpc['Guild/SyncGuildChannels']({
                guild_id: decodeSnowflake(guild.id),
                channels,
              }),
            ),
            Effect.catchAll((error) =>
              Effect.logError(`Failed to sync channels for guild ${guild.id}`, error),
            ),
          ),
        ),
        Effect.tap(() =>
          rest.listGuildMembers(guild.id, { limit: 1000 }).pipe(
            Effect.map((guildMembers) =>
              Arr.filterMap(guildMembers, (m) =>
                decodeGuildMember(m).pipe(
                  Option.filter((decoded) => !decoded.user.bot),
                  Option.map((decoded) => ({
                    discord_id: decoded.user.id,
                    username: decoded.user.username,
                    avatar: decoded.user.avatar,
                    roles: decoded.roles,
                  })),
                ),
              ),
            ),
            Effect.tap((members) =>
              rpc['Guild/ReconcileMembers']({
                guild_id: decodeSnowflake(guild.id),
                members,
              }),
            ),
            Effect.catchAll((error) =>
              Effect.logError(`Failed to reconcile members for guild ${guild.id}`, error),
            ),
          ),
        ),
        Effect.catchAll((error) => Effect.logError(`Failed to register guild ${guild.id}`, error)),
      ),
    ),
  ),
  Effect.let('guildDelete', ({ gateway, rpc }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildDelete, (guild) =>
      guild.unavailable
        ? Effect.logInfo(`Guild unavailable (outage): ${guild.id}`)
        : Effect.Do.pipe(
            Effect.tap(() => Effect.logInfo(`Guild removed: ${guild.id}`)),
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
  Effect.let('guildMemberAdd', ({ gateway, rpc }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberAdd, (member) => {
      const user = decodeUser(member.user);
      return Effect.Do.pipe(
        Effect.tap(() =>
          Effect.logInfo(`Member joined: ${user.username} in guild ${member.guild_id}`),
        ),
        Effect.tap(() =>
          user.bot
            ? Effect.logInfo('Skipping bot')
            : rpc['Guild/RegisterMember']({
                guild_id: decodeSnowflake(member.guild_id),
                discord_id: user.id,
                username: user.username,
                avatar: user.avatar,
                roles: Arr.map(member.roles, (r) => decodeSnowflake(r)),
              }),
        ),
        Effect.catchAll((error) =>
          Effect.logError(`Failed to register member ${user.username}`, error),
        ),
      );
    }),
  ),
  Effect.let('guildMemberRemove', ({ gateway }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberRemove, (member) =>
      Effect.logInfo(`Member left: ${member.user.username} from guild ${member.guild_id}`),
    ),
  ),
  Effect.let('guildMemberUpdate', ({ gateway }) =>
    gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.GuildMemberUpdate, (member) =>
      Effect.logInfo(`Member updated: ${member.user.username} in guild ${member.guild_id}`),
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
