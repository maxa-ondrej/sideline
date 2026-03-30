import { HttpApiBuilder } from '@effect/platform';
import { Auth, GroupApi } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, Option, pipe } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordChannelsRepository } from '~/repositories/DiscordChannelsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const forbidden = new GroupApi.Forbidden();

export const GroupApiLive = HttpApiBuilder.group(Api, 'group', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('groups', () => GroupsRepository),
    Effect.bind('roles', () => RolesRepository),
    Effect.bind('channelSync', () => ChannelSyncEventsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('channelMappings', () => DiscordChannelMappingRepository),
    Effect.bind('teams', () => TeamsRepository),
    Effect.bind('discordChannels', () => DiscordChannelsRepository),
    Effect.bind('teamSettings', () => TeamSettingsRepository),
    Effect.map(
      ({
        members,
        groups,
        roles,
        channelSync,
        users,
        channelMappings,
        teams,
        discordChannels,
        teamSettings,
      }) =>
        handlers
          .handle('listGroups', ({ path: { teamId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('list', () => groups.findGroupsByTeamId(teamId)),
              Effect.map(({ list }) =>
                Array.map(
                  list,
                  (g) =>
                    new GroupApi.GroupInfo({
                      groupId: g.id,
                      teamId: g.team_id,
                      parentId: g.parent_id,
                      name: g.name,
                      emoji: g.emoji,
                      memberCount: g.member_count,
                    }),
                ),
              ),
            ),
          )
          .handle('createGroup', ({ path: { teamId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('group', () =>
                groups.insertGroup(teamId, payload.name, payload.parentId, payload.emoji),
              ),
              Effect.bind('settings', () => teamSettings.findByTeamId(teamId)),
              Effect.tap(({ group, settings }) =>
                Option.match(settings, {
                  onNone: () => channelSync.emitChannelCreated(teamId, group.id, group.name),
                  onSome: (s) =>
                    s.create_discord_channel_on_group
                      ? channelSync.emitChannelCreated(teamId, group.id, group.name)
                      : Effect.void,
                }),
              ),
              Effect.map(
                ({ group }) =>
                  new GroupApi.GroupInfo({
                    groupId: group.id,
                    teamId: group.team_id,
                    parentId: group.parent_id,
                    name: group.name,
                    emoji: group.emoji,
                    memberCount: 0,
                  }),
              ),
              Effect.catchTag('GroupNameAlreadyTakenError', () =>
                Effect.fail(new GroupApi.GroupNameAlreadyTaken()),
              ),
              Effect.catchTag(
                'NoSuchElementException',
                LogicError.withMessage(
                  () => `Failed creating group "${payload.name}" — no row returned`,
                ),
              ),
            ),
          )
          .handle('getGroup', ({ path: { teamId, groupId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ group }) =>
                group.team_id !== teamId ? Effect.fail(new GroupApi.GroupNotFound()) : Effect.void,
              ),
              Effect.bind('groupMembers', () => groups.findMembersByGroupId(groupId)),
              Effect.bind('groupRoles', () => groups.getRolesForGroup(groupId)),
              Effect.map(
                ({ group, groupMembers, groupRoles }) =>
                  new GroupApi.GroupDetail({
                    groupId: group.id,
                    teamId: group.team_id,
                    parentId: group.parent_id,
                    name: group.name,
                    emoji: group.emoji,
                    roles: Array.map(groupRoles, (r) => ({
                      roleId: r.role_id,
                      roleName: r.role_name,
                    })),
                    members: Array.map(groupMembers, (m) => ({
                      memberId: m.member_id,
                      name: m.name,
                      username: m.username,
                    })),
                  }),
              ),
            ),
          )
          .handle('updateGroup', ({ path: { teamId, groupId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('existing', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ existing }) =>
                existing.team_id !== teamId
                  ? Effect.fail(new GroupApi.GroupNotFound())
                  : Effect.void,
              ),
              Effect.bind('updated', () =>
                groups.updateGroupById(groupId, payload.name, payload.emoji),
              ),
              Effect.bind('memberCount', () => groups.getMemberCount(groupId)),
              Effect.map(
                ({ updated, memberCount }) =>
                  new GroupApi.GroupInfo({
                    groupId: updated.id,
                    teamId: updated.team_id,
                    parentId: updated.parent_id,
                    name: updated.name,
                    emoji: updated.emoji,
                    memberCount,
                  }),
              ),
              Effect.catchTag('GroupNameAlreadyTakenError', () =>
                Effect.fail(new GroupApi.GroupNameAlreadyTaken()),
              ),
              Effect.catchTag(
                'NoSuchElementException',
                LogicError.withMessage(() => `Failed updating group ${groupId} — no row returned`),
              ),
            ),
          )
          .handle('deleteGroup', ({ path: { teamId, groupId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('existing', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatten,
                  Effect.catchTag('NoSuchElementException', () =>
                    Effect.fail(new GroupApi.GroupNotFound()),
                  ),
                ),
              ),
              Effect.tap(({ existing }) =>
                existing.team_id !== teamId
                  ? Effect.fail(new GroupApi.GroupNotFound()).pipe(
                      Effect.tapError(() =>
                        Effect.logWarning(
                          `Tried to delete group ${groupId} of team ${teamId}, but it actually belongs to ${existing.team_id}`,
                        ),
                      ),
                    )
                  : Effect.void,
              ),
              Effect.bind('mappingToDelete', () => channelMappings.findByGroupId(teamId, groupId)),
              Effect.bind('settings', () => teamSettings.findByTeamId(teamId)),
              Effect.tap(() => groups.archiveGroupById(groupId)),
              Effect.tap(({ existing, mappingToDelete, settings }) =>
                Option.match(mappingToDelete, {
                  onNone: () => Effect.void,
                  onSome: (mapping) => {
                    const archiveCategoryId = Option.flatMap(
                      settings,
                      (s) => s.discord_archive_category_id,
                    );
                    return Option.match(archiveCategoryId, {
                      onNone: () =>
                        channelSync
                          .emitChannelDeleted(
                            teamId,
                            groupId,
                            existing.name,
                            mapping.discord_channel_id,
                            mapping.discord_role_id,
                          )
                          .pipe(Effect.tap(() => channelMappings.deleteByGroupId(teamId, groupId))),
                      onSome: (categoryId) =>
                        channelSync.emitChannelArchived(
                          teamId,
                          groupId,
                          existing.name,
                          mapping.discord_channel_id,
                          mapping.discord_role_id,
                          categoryId,
                        ),
                    });
                  },
                }),
              ),
              Effect.asVoid,
            ),
          )
          .handle('addGroupMember', ({ path: { teamId, groupId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.bind('_member', () =>
                members.findRosterMemberByIds(teamId, payload.memberId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.MemberNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(() => groups.addMemberById(groupId, payload.memberId)),
              Effect.tap(({ _group, _member }) =>
                users.findById(_member.user_id).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.void,
                      onSome: (user) =>
                        channelSync.emitMemberAdded(
                          teamId,
                          groupId,
                          _group.name,
                          payload.memberId,
                          user.discord_id,
                        ),
                    }),
                  ),
                ),
              ),
              Effect.asVoid,
            ),
          )
          .handle('removeGroupMember', ({ path: { teamId, groupId, memberId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.bind('_member', () =>
                members.findRosterMemberByIds(teamId, memberId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.MemberNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(() => groups.removeMemberById(groupId, memberId)),
              Effect.tap(({ _group, _member }) =>
                users.findById(_member.user_id).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.void,
                      onSome: (user) =>
                        channelSync.emitMemberRemoved(
                          teamId,
                          groupId,
                          _group.name,
                          memberId,
                          user.discord_id,
                        ),
                    }),
                  ),
                ),
              ),
              Effect.asVoid,
            ),
          )
          .handle('assignGroupRole', ({ path: { teamId, groupId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.tap(() => roles.assignRoleToGroup(payload.roleId, groupId)),
              Effect.asVoid,
            ),
          )
          .handle('unassignGroupRole', ({ path: { teamId, groupId, roleId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.tap(() => roles.unassignRoleFromGroup(roleId, groupId)),
              Effect.asVoid,
            ),
          )
          .handle('moveGroup', ({ path: { teamId, groupId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('existing', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              // Validate no circular refs if moving to a new parent
              Effect.tap(() =>
                Option.match(payload.parentId, {
                  onNone: () => Effect.void,
                  onSome: (pid) =>
                    groups
                      .getAncestorIds(pid)
                      .pipe(
                        Effect.flatMap((ancestors) =>
                          pipe(ancestors, Array.contains(groupId))
                            ? Effect.fail(forbidden)
                            : Effect.void,
                        ),
                      ),
                }),
              ),
              Effect.bind('updated', () => groups.moveGroup(groupId, payload.parentId)),
              Effect.bind('memberCount', () => groups.getMemberCount(groupId)),
              Effect.map(
                ({ updated, memberCount }) =>
                  new GroupApi.GroupInfo({
                    groupId: updated.id,
                    teamId: updated.team_id,
                    parentId: updated.parent_id,
                    name: updated.name,
                    emoji: updated.emoji,
                    memberCount,
                  }),
              ),
              Effect.catchTag(
                'NoSuchElementException',
                LogicError.withMessage(() => `Failed moving group ${groupId} — no row returned`),
              ),
            ),
          )
          .handle('getChannelMapping', ({ path: { teamId, groupId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.bind('mapping', () => channelMappings.findByGroupId(teamId, groupId)),
              Effect.bind('team', () =>
                teams.findById(teamId).pipe(
                  Effect.flatten,
                  Effect.catchTag('NoSuchElementException', () => Effect.fail(forbidden)),
                ),
              ),
              Effect.bind('allChannels', ({ team }) =>
                discordChannels.findByGuildId(team.guild_id),
              ),
              Effect.map(({ mapping, allChannels }) =>
                Option.match(mapping, {
                  onNone: () => Option.none(),
                  onSome: (row) =>
                    Option.some(
                      new GroupApi.ChannelMappingInfo({
                        discordChannelId: row.discord_channel_id,
                        discordChannelName: Option.fromNullable(
                          allChannels.find((ch) => ch.channel_id === row.discord_channel_id)
                            ?.name ?? null,
                        ),
                        discordRoleId: row.discord_role_id,
                      }),
                    ),
                }),
              ),
            ),
          )
          .handle('setChannelMapping', ({ path: { teamId, groupId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.tap(() =>
                channelMappings
                  .findAllByTeam(teamId)
                  .pipe(
                    Effect.flatMap((mappings) =>
                      mappings.some((m) => m.discord_channel_id === payload.discordChannelId)
                        ? Effect.fail(forbidden)
                        : Effect.void,
                    ),
                  ),
              ),
              Effect.tap(() =>
                channelMappings.insertWithoutRole(teamId, groupId, payload.discordChannelId),
              ),
              Effect.tap(({ _group }) =>
                channelSync.emitChannelCreated(
                  teamId,
                  groupId,
                  _group.name,
                  Option.some(payload.discordChannelId),
                ),
              ),
              Effect.bind('team', () =>
                teams.findById(teamId).pipe(
                  Effect.flatten,
                  Effect.catchTag('NoSuchElementException', () => Effect.fail(forbidden)),
                ),
              ),
              Effect.bind('allChannels', ({ team }) =>
                discordChannels.findByGuildId(team.guild_id),
              ),
              Effect.map(
                ({ allChannels }) =>
                  new GroupApi.ChannelMappingInfo({
                    discordChannelId: payload.discordChannelId,
                    discordChannelName: Option.fromNullable(
                      allChannels.find((ch) => ch.channel_id === payload.discordChannelId)?.name ??
                        null,
                    ),
                    discordRoleId: Option.none(),
                  }),
              ),
            ),
          )
          .handle('deleteChannelMapping', ({ path: { teamId, groupId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('_group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.bind('mapping', () =>
                channelMappings.findByGroupId(teamId, groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ _group, mapping }) =>
                channelSync.emitChannelDeleted(
                  teamId,
                  groupId,
                  _group.name,
                  mapping.discord_channel_id,
                  mapping.discord_role_id,
                ),
              ),
              Effect.tap(() => channelMappings.deleteByGroupId(teamId, groupId)),
              Effect.asVoid,
            ),
          )
          .handle('createChannel', ({ path: { teamId, groupId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('group', () =>
                groups.findGroupById(groupId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new GroupApi.GroupNotFound()),
                      onSome: (g) =>
                        g.team_id !== teamId
                          ? Effect.fail(new GroupApi.GroupNotFound())
                          : Effect.succeed(g),
                    }),
                  ),
                ),
              ),
              Effect.tap(({ group }) =>
                channelSync.emitChannelCreated(teamId, groupId, group.name),
              ),
              Effect.asVoid,
            ),
          )
          .handle('listDiscordChannels', ({ path: { teamId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('team', () =>
                teams.findById(teamId).pipe(
                  Effect.flatten,
                  Effect.catchTag('NoSuchElementException', () => Effect.fail(forbidden)),
                ),
              ),
              Effect.bind('channels', ({ team }) => discordChannels.findByGuildId(team.guild_id)),
              Effect.bind('mappings', () => channelMappings.findAllByTeam(teamId)),
              Effect.map(({ channels, mappings }) => {
                const mappedChannelIds = new Set(mappings.map((m) => m.discord_channel_id));
                return Array.filterMap(channels, (ch) =>
                  mappedChannelIds.has(ch.channel_id)
                    ? Option.none()
                    : Option.some(
                        new GroupApi.DiscordChannelInfo({
                          id: ch.channel_id,
                          name: ch.name,
                          type: ch.type,
                          parentId: ch.parent_id,
                        }),
                      ),
                );
              }),
            ),
          ),
    ),
  ),
);
