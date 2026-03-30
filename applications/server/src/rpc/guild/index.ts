import { type Discord, GuildRpcGroup, type Team, type TeamMember } from '@sideline/domain';
import { Array, Effect, Option, pipe } from 'effect';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';
import { DiscordRoleMappingRepository } from '~/repositories/DiscordRoleMappingRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

type RegisterMemberPayload = {
  readonly guild_id: Discord.Snowflake;
  readonly discord_id: string;
  readonly username: string;
  readonly avatar: Option.Option<string>;
  readonly roles: ReadonlyArray<string>;
};

type Deps = {
  teams: TeamsRepository;
  users: UsersRepository;
  members: TeamMembersRepository;
  roleMappings: DiscordRoleMappingRepository;
  channelMappings: DiscordChannelMappingRepository;
  groups: GroupsRepository;
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
                Option.flatMap(m.group_id, (groupId) =>
                  Option.flatMap(m.discord_role_id, (roleId) =>
                    roles.includes(roleId) ? Option.some(groupId) : Option.none(),
                  ),
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
  ({ guild_id, discord_id, username, avatar, roles }: RegisterMemberPayload) =>
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
                }),
              ),
              Effect.bind('existingMembership', ({ user }) =>
                deps.members.findMembershipByIds(team.id, user.id),
              ),
              Effect.tap(({ existingMembership, user }) =>
                Option.isSome(existingMembership) && existingMembership.value.active
                  ? Effect.logInfo(`Member ${username} already active in team ${team.id}`)
                  : (Option.isNone(existingMembership)
                      ? deps.members.addMember({
                          team_id: team.id,
                          user_id: user.id,
                          active: true,
                          joined_at: undefined,
                        })
                      : Effect.succeed(existingMembership.value as unknown as TeamMember.TeamMember)
                    ).pipe(
                      Effect.tap((newMember) => setupNewMember(deps, team, newMember, roles)),
                      Effect.tap(() =>
                        Effect.logInfo(`Registered member ${username} in team ${team.id}`),
                      ),
                    ),
              ),
            ),
        }),
      ),
      Effect.catchTag('MemberAlreadyExistsError', 'NoSuchElementException', (error) =>
        Effect.logError(`RegisterMember failed for ${username}`, error),
      ),
    );

export const GuildsRpcLive = Effect.all([
  BotGuildsRepository,
  DiscordChannelsRepository,
  TeamsRepository,
  UsersRepository,
  TeamMembersRepository,
  DiscordRoleMappingRepository,
  DiscordChannelMappingRepository,
  GroupsRepository,
]).pipe(
  Effect.map(
    ([
      botGuilds,
      discordChannels,
      teams,
      users,
      members,
      roleMappings,
      channelMappings,
      groups,
    ]) => {
      const deps: Deps = { teams, users, members, roleMappings, channelMappings, groups };
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
        }) =>
          discordChannels.syncChannels(
            guild_id,
            channels.map((c) => ({
              channel_id: c.channel_id,
              name: c.name,
              type: c.type,
              parent_id: c.parent_id,
            })),
          ),

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
                  }),
                ),
                { concurrency: 5 },
              ),
            ),
            Effect.tap(() => Effect.logInfo(`Reconciliation complete for guild ${guild_id}`)),
          ),
      };
    },
  ),
  (handlers) => GuildRpcGroup.GuildRpcGroup.toLayer(handlers),
);
