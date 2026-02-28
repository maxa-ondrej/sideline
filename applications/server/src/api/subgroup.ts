import { HttpApiBuilder } from '@effect/platform';
import { Auth, type Discord, SubgroupApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { SubgroupsRepository } from '~/repositories/SubgroupsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const forbidden = new SubgroupApi.Forbidden();

export const SubgroupApiLive = HttpApiBuilder.group(Api, 'subgroup', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('subgroups', () => SubgroupsRepository),
    Effect.bind('channelSync', () => ChannelSyncEventsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.map(({ members, subgroups, channelSync, users }) =>
      handlers
        .handle('listSubgroups', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('list', () => subgroups.findSubgroupsByTeamId(teamId).pipe(Effect.orDie)),
            Effect.map(({ list }) =>
              list.map(
                (s) =>
                  new SubgroupApi.SubgroupInfo({
                    subgroupId: s.id,
                    teamId: s.team_id,
                    name: s.name,
                    memberCount: s.member_count,
                  }),
              ),
            ),
          ),
        )
        .handle('createSubgroup', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('subgroup', () =>
              subgroups.insertSubgroup(teamId, payload.name).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ subgroup }) =>
              channelSync
                .emitIfGuildLinked(
                  teamId,
                  'channel_created',
                  subgroup.id,
                  Option.some(subgroup.name),
                )
                .pipe(Effect.catchAll(() => Effect.void)),
            ),
            Effect.map(
              ({ subgroup }) =>
                new SubgroupApi.SubgroupInfo({
                  subgroupId: subgroup.id,
                  teamId: subgroup.team_id,
                  name: subgroup.name,
                  memberCount: 0,
                }),
            ),
          ),
        )
        .handle('getSubgroup', ({ path: { teamId, subgroupId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('subgroup', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.SubgroupNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ subgroup }) =>
              subgroup.team_id !== teamId
                ? Effect.fail(new SubgroupApi.SubgroupNotFound())
                : Effect.void,
            ),
            Effect.bind('sgMembers', () =>
              subgroups.findMembersBySubgroupId(subgroupId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('permissions', () =>
              subgroups
                .getPermissionsForSubgroupId(subgroupId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ subgroup, sgMembers, permissions }) =>
                new SubgroupApi.SubgroupDetail({
                  subgroupId: subgroup.id,
                  teamId: subgroup.team_id,
                  name: subgroup.name,
                  permissions: [...permissions],
                  members: sgMembers.map((m) => ({
                    memberId: m.member_id,
                    name: m.name,
                    discordUsername: m.discord_username,
                  })),
                }),
            ),
          ),
        )
        .handle('updateSubgroup', ({ path: { teamId, subgroupId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('existing', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.SubgroupNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new SubgroupApi.SubgroupNotFound())
                : Effect.void,
            ),
            Effect.bind('updated', () =>
              subgroups
                .updateSubgroup(subgroupId, payload.name)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('memberCount', () =>
              subgroups.getMemberCount(subgroupId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ updated, memberCount }) =>
                new SubgroupApi.SubgroupInfo({
                  subgroupId: updated.id,
                  teamId: updated.team_id,
                  name: updated.name,
                  memberCount,
                }),
            ),
          ),
        )
        .handle('deleteSubgroup', ({ path: { teamId, subgroupId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('existing', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.orDie,
                Effect.flatten,
                Effect.catchTag('NoSuchElementException', () => new SubgroupApi.SubgroupNotFound()),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new SubgroupApi.SubgroupNotFound()).pipe(
                    Effect.tapError(() =>
                      Effect.logWarning(
                        `Tried to delete subgroup ${subgroupId} of team ${teamId}, but it actually belongs to ${existing.team_id}`,
                      ),
                    ),
                  )
                : Effect.void,
            ),
            Effect.tap(() => subgroups.archiveSubgroupById(subgroupId).pipe(Effect.orDie)),
            Effect.tap(({ existing }) =>
              channelSync
                .emitIfGuildLinked(
                  teamId,
                  'channel_deleted',
                  subgroupId,
                  Option.some(existing.name),
                )
                .pipe(Effect.catchAll((e) => Effect.logError('Failed to notify guilds', e))),
            ),
            Effect.asVoid,
          ),
        )
        .handle('addSubgroupMember', ({ path: { teamId, subgroupId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('_subgroup', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.SubgroupNotFound()),
                    onSome: (sg) =>
                      sg.team_id !== teamId
                        ? Effect.fail(new SubgroupApi.SubgroupNotFound())
                        : Effect.succeed(sg),
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, payload.memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              subgroups
                .addMemberById(subgroupId, payload.memberId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ _member }) =>
              users.findById(_member.user_id).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (user) =>
                      channelSync.emitIfGuildLinked(
                        teamId,
                        'member_added',
                        subgroupId,
                        Option.none(),
                        Option.some(payload.memberId),
                        Option.some(user.discord_id as Discord.Snowflake),
                      ),
                  }),
                ),
                Effect.catchAll(() => Effect.void),
              ),
            ),
            Effect.asVoid,
          ),
        )
        .handle('removeSubgroupMember', ({ path: { teamId, subgroupId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('_subgroup', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.SubgroupNotFound()),
                    onSome: (sg) =>
                      sg.team_id !== teamId
                        ? Effect.fail(new SubgroupApi.SubgroupNotFound())
                        : Effect.succeed(sg),
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              subgroups
                .removeMemberById(subgroupId, memberId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ _member }) =>
              users.findById(_member.user_id).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (user) =>
                      channelSync.emitIfGuildLinked(
                        teamId,
                        'member_removed',
                        subgroupId,
                        Option.none(),
                        Option.some(memberId),
                        Option.some(user.discord_id as Discord.Snowflake),
                      ),
                  }),
                ),
                Effect.catchAll(() => Effect.void),
              ),
            ),
            Effect.asVoid,
          ),
        )
        .handle('setSubgroupPermissions', ({ path: { teamId, subgroupId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('subgroup', () =>
              subgroups.findSubgroupById(subgroupId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new SubgroupApi.SubgroupNotFound()),
                    onSome: (sg) =>
                      sg.team_id !== teamId
                        ? Effect.fail(new SubgroupApi.SubgroupNotFound())
                        : Effect.succeed(sg),
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              subgroups
                .setSubgroupPermissions(subgroupId, payload.permissions)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('sgMembers', () =>
              subgroups.findMembersBySubgroupId(subgroupId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ subgroup, sgMembers }) =>
                new SubgroupApi.SubgroupDetail({
                  subgroupId: subgroup.id,
                  teamId: subgroup.team_id,
                  name: subgroup.name,
                  permissions: [...payload.permissions],
                  members: sgMembers.map((m) => ({
                    memberId: m.member_id,
                    name: m.name,
                    discordUsername: m.discord_username,
                  })),
                }),
            ),
          ),
        ),
    ),
  ),
);
