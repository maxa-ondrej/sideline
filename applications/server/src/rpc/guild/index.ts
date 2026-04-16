import { type Discord, GuildRpcGroup, type Team, type TeamMember } from '@sideline/domain';
import { Array, type Cause, Effect, Option, pipe, Result, type ServiceMap } from 'effect';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';
import { DiscordRoleMappingRepository } from '~/repositories/DiscordRoleMappingRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import {
  type MemberAlreadyExistsError,
  TeamMembersRepository,
} from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

type RegisterMemberPayload = {
  readonly guild_id: Discord.Snowflake;
  readonly discord_id: string;
  readonly username: string;
  readonly avatar: Option.Option<string>;
  readonly roles: ReadonlyArray<string>;
  readonly nickname: Option.Option<string>;
};

type Deps = {
  teams: ServiceMap.Service.Shape<typeof TeamsRepository>;
  users: ServiceMap.Service.Shape<typeof UsersRepository>;
  members: ServiceMap.Service.Shape<typeof TeamMembersRepository>;
  roleMappings: ServiceMap.Service.Shape<typeof DiscordRoleMappingRepository>;
  channelMappings: ServiceMap.Service.Shape<typeof DiscordChannelMappingRepository>;
  groups: ServiceMap.Service.Shape<typeof GroupsRepository>;
};

const setupNewMember = (
  deps: Deps,
  team: { id: Team.TeamId },
  newMember: { id: TeamMember.TeamMemberId },
  roles: ReadonlyArray<string>,
) =>
  Effect.Do.pipe(
    Effect.tap(() =>
      deps.members.getPlayerRoleId(team.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.logInfo('No Player role found, skipping'),
            onSome: (playerRole) => deps.members.assignRole(newMember.id, playerRole.id),
          }),
        ),
      ),
    ),
    Effect.tap(() =>
      deps.roleMappings.findAllByTeam(team.id).pipe(
        Effect.tap((mappings) =>
          Effect.all(
            pipe(
              mappings,
              Array.filter((m) => roles.includes(m.discord_role_id)),
              Array.map((m) => deps.members.assignRole(newMember.id, m.role_id)),
            ),
            { concurrency: 'unbounded' },
          ),
        ),
      ),
    ),
    Effect.tap(() =>
      deps.channelMappings.findAllByTeam(team.id).pipe(
        Effect.tap((mappings) =>
          Effect.all(
            pipe(
              mappings,
              Array.filterMap((m) =>
                Result.fromOption(
                  Option.flatMap(m.group_id, (groupId) =>
                    Option.flatMap(m.discord_role_id, (roleId) =>
                      roles.includes(roleId) ? Option.some(groupId) : Option.none(),
                    ),
                  ),
                  () => undefined,
                ),
              ),
              Array.map((groupId) => deps.groups.addMemberById(groupId, newMember.id)),
            ),
            { concurrency: 'unbounded' },
          ),
        ),
      ),
    ),
  );

const registerMemberLogic =
  (deps: Deps) =>
  ({ guild_id, discord_id, username, avatar, roles, nickname }: RegisterMemberPayload) =>
    Effect.Do.pipe(
      Effect.bind('teamOption', () => deps.teams.findByGuildId(guild_id)),
      Effect.flatMap(({ teamOption }) =>
        Option.match(teamOption, {
          onNone: () =>
            Effect.logInfo(`No team found for guild ${guild_id}, skipping member registration`),
          onSome: (team) =>
            Effect.Do.pipe(
              Effect.bind('user', () =>
                deps.users.upsertFromDiscord({
                  discord_id,
                  username,
                  avatar,
                  discord_nickname: nickname,
                }),
              ),
              Effect.bind('existingMembership', ({ user }) =>
                deps.members.findMembershipByIds(team.id, user.id),
              ),
              Effect.tap(({ existingMembership, user }) => {
                if (Option.isSome(existingMembership) && existingMembership.value.active) {
                  return Effect.logInfo(`Member ${username} already active in team ${team.id}`);
                }
                const resolveMemberId: Effect.Effect<
                  { id: TeamMember.TeamMemberId },
                  MemberAlreadyExistsError | Cause.NoSuchElementError,
                  never
                > = Option.isNone(existingMembership)
                  ? Effect.map(
                      deps.members.addMember({
                        team_id: team.id,
                        user_id: user.id,
                        active: true,
                        joined_at: undefined,
                      }),
                      (m) => ({ id: m.id }),
                    )
                  : Effect.succeed({ id: existingMembership.value.id });
                return resolveMemberId.pipe(
                  Effect.tap((newMember) => setupNewMember(deps, team, newMember, roles)),
                  Effect.tap(() =>
                    Effect.logInfo(`Registered member ${username} in team ${team.id}`),
                  ),
                );
              }),
            ),
        }),
      ),
      Effect.catchTag(['MemberAlreadyExistsError', 'NoSuchElementError'], (error) =>
        Effect.logError(`RegisterMember failed for ${username}`, error),
      ),
    );

const buildHandlers = (
  botGuilds: ServiceMap.Service.Shape<typeof BotGuildsRepository>,
  discordChannels: ServiceMap.Service.Shape<typeof DiscordChannelsRepository>,
  deps: Deps,
) => {
  const register = registerMemberLogic(deps);

  return {
    'Guild/RegisterGuild': ({
      guild_id,
      guild_name,
    }: {
      readonly guild_id: Discord.Snowflake;
      readonly guild_name: string;
    }) => botGuilds.upsert(guild_id, guild_name),

    'Guild/UnregisterGuild': ({ guild_id }: { readonly guild_id: Discord.Snowflake }) =>
      botGuilds.remove(guild_id),

    'Guild/IsGuildRegistered': ({ guild_id }: { readonly guild_id: Discord.Snowflake }) =>
      botGuilds.exists(guild_id),

    'Guild/SyncGuildChannels': ({
      guild_id,
      channels,
    }: {
      readonly guild_id: Discord.Snowflake;
      readonly channels: ReadonlyArray<{
        readonly channel_id: Discord.Snowflake;
        readonly name: string;
        readonly type: number;
        readonly parent_id: Option.Option<Discord.Snowflake>;
      }>;
    }) => discordChannels.syncChannels(guild_id, channels),

    'Guild/UpdateChannelName': ({
      channel_id,
      name,
    }: {
      readonly channel_id: Discord.Snowflake;
      readonly name: string;
    }) => discordChannels.updateChannelName(channel_id, name),

    'Guild/UpsertChannel': ({
      guild_id,
      channel_id,
      name,
      type,
      parent_id,
    }: {
      readonly guild_id: Discord.Snowflake;
      readonly channel_id: Discord.Snowflake;
      readonly name: string;
      readonly type: number;
      readonly parent_id: Option.Option<Discord.Snowflake>;
    }) => discordChannels.upsertChannel(guild_id, channel_id, name, type, parent_id),

    'Guild/DeleteChannel': ({
      guild_id,
      channel_id,
    }: {
      readonly guild_id: Discord.Snowflake;
      readonly channel_id: Discord.Snowflake;
    }) => discordChannels.deleteChannel(guild_id, channel_id),

    'Guild/RegisterMember': (payload: RegisterMemberPayload) => register(payload),

    'Guild/ReconcileMembers': ({
      guild_id,
      members: membersList,
    }: {
      readonly guild_id: Discord.Snowflake;
      readonly members: ReadonlyArray<{
        readonly discord_id: string;
        readonly username: string;
        readonly avatar: Option.Option<string>;
        readonly roles: ReadonlyArray<string>;
        readonly nickname: Option.Option<string>;
      }>;
    }) =>
      Effect.Do.pipe(
        Effect.tap(() =>
          Effect.logInfo(`Reconciling ${membersList.length} members for guild ${guild_id}`),
        ),
        Effect.tap(() =>
          Effect.all(
            Array.map(membersList, (member) =>
              register({
                guild_id,
                discord_id: member.discord_id,
                username: member.username,
                avatar: member.avatar,
                roles: member.roles,
                nickname: member.nickname,
              }),
            ),
            { concurrency: 5 },
          ),
        ),
        Effect.tap(() => Effect.logInfo(`Reconciliation complete for guild ${guild_id}`)),
        Effect.asVoid,
      ),
  };
};

export const GuildsRpcLive = Effect.Do.pipe(
  Effect.bind('botGuilds', () => BotGuildsRepository.asEffect()),
  Effect.bind('discordChannels', () => DiscordChannelsRepository.asEffect()),
  Effect.bind('teams', () => TeamsRepository.asEffect()),
  Effect.bind('users', () => UsersRepository.asEffect()),
  Effect.bind('members', () => TeamMembersRepository.asEffect()),
  Effect.bind('roleMappings', () => DiscordRoleMappingRepository.asEffect()),
  Effect.bind('channelMappings', () => DiscordChannelMappingRepository.asEffect()),
  Effect.bind('groups', () => GroupsRepository.asEffect()),
  Effect.map(
    ({
      botGuilds,
      discordChannels,
      teams,
      users,
      members,
      roleMappings,
      channelMappings,
      groups,
    }) =>
      buildHandlers(botGuilds, discordChannels, {
        teams,
        users,
        members,
        roleMappings,
        channelMappings,
        groups,
      }),
  ),
  (handlers) => GuildRpcGroup.GuildRpcGroup.toLayer(handlers),
);
