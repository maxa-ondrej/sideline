import { HttpApiBuilder } from '@effect/platform';
import { Auth, RoleApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const forbidden = new RoleApi.Forbidden();

export const RoleApiLive = HttpApiBuilder.group(Api, 'role', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('roles', () => RolesRepository),
    Effect.bind('notifications', () => NotificationsRepository),
    Effect.bind('syncEvents', () => RoleSyncEventsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.map(({ members, roles, notifications, syncEvents, users }) =>
      handlers
        .handle('listRoles', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:view', forbidden)),
            Effect.bind('roleList', () =>
              roles.findRolesByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(({ roleList }) =>
              roleList.map(
                (r) =>
                  new RoleApi.RoleInfo({
                    roleId: r.id,
                    teamId: teamId,
                    name: r.name,
                    isBuiltIn: r.is_built_in,
                    permissionCount: r.permission_count,
                  }),
              ),
            ),
          ),
        )
        .handle('createRole', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('role', () =>
              roles.insertRole(teamId, payload.name).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ role }) =>
              roles
                .setRolePermissions(role.id, payload.permissions)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ role }) =>
              syncEvents.emitIfGuildLinked(teamId, 'role_created', role.id, role.name).pipe(
                Effect.tapError((e) => Effect.logWarning('Failed to emit sync event', e)),
                Effect.catchAll(() => Effect.void),
              ),
            ),
            Effect.map(
              ({ role }) =>
                new RoleApi.RoleDetail({
                  roleId: role.id,
                  teamId: teamId,
                  name: role.name,
                  isBuiltIn: role.is_built_in,
                  permissions: [...payload.permissions],
                }),
            ),
          ),
        )
        .handle('getRole', ({ path: { teamId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:view', forbidden)),
            Effect.bind('role', () =>
              roles.findRoleById(roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('permissions', ({ role }) =>
              roles.getPermissionsForRoleId(role.id).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ role, permissions }) =>
                new RoleApi.RoleDetail({
                  roleId: role.id,
                  teamId: teamId,
                  name: role.name,
                  isBuiltIn: role.is_built_in,
                  permissions: [...permissions],
                }),
            ),
          ),
        )
        .handle('updateRole', ({ path: { teamId, roleId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              roles.findRoleById(roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.is_built_in && payload.name !== null
                ? Effect.fail(new RoleApi.CannotModifyBuiltIn())
                : Effect.void,
            ),
            Effect.bind('updated', ({ existing }) =>
              payload.name !== null
                ? roles.updateRole(roleId, payload.name).pipe(Effect.mapError(() => forbidden))
                : Effect.succeed(existing),
            ),
            Effect.tap(() =>
              payload.permissions !== null
                ? roles
                    .setRolePermissions(roleId, payload.permissions)
                    .pipe(Effect.mapError(() => forbidden))
                : Effect.void,
            ),
            Effect.bind('permissions', () =>
              roles.getPermissionsForRoleId(roleId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ updated, permissions }) =>
                new RoleApi.RoleDetail({
                  roleId: updated.id,
                  teamId: teamId,
                  name: updated.name,
                  isBuiltIn: updated.is_built_in,
                  permissions: [...permissions],
                }),
            ),
          ),
        )
        .handle('deleteRole', ({ path: { teamId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              roles.findRoleById(roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.is_built_in ? Effect.fail(new RoleApi.CannotModifyBuiltIn()) : Effect.void,
            ),
            Effect.bind('memberCount', () =>
              roles.getMemberCountForRole(roleId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ memberCount }) =>
              memberCount > 0 ? Effect.fail(new RoleApi.RoleInUse()) : Effect.void,
            ),
            Effect.tap(({ existing }) =>
              syncEvents
                .emitIfGuildLinked(teamId, 'role_deleted', existing.id, existing.name)
                .pipe(
                  Effect.tapError((e) => Effect.logWarning('Failed to emit sync event', e)),
                ),
            ),
            Effect.tap(() => roles.deleteRoleById(roleId).pipe(Effect.mapError(() => forbidden))),
            Effect.asVoid,
          ),
        )
        .handle('assignRole', ({ path: { teamId, memberId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('targetMember', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('role', () =>
              roles.findRoleById(payload.roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ role }) =>
              role.team_id !== teamId ? Effect.fail(new RoleApi.RoleNotFound()) : Effect.void,
            ),
            Effect.tap(() =>
              members.assignRole(memberId, payload.roleId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ targetMember, role }) =>
              notifications
                .insert(
                  teamId,
                  targetMember.user_id,
                  'role_assigned',
                  `Role "${role.name}" assigned`,
                  `You have been assigned the "${role.name}" role.`,
                )
                .pipe(
                  Effect.tapError((e) => Effect.logWarning('Failed to create notification', e)),
                  Effect.catchAll(() => Effect.void),
                ),
            ),
            Effect.tap(({ targetMember, role }) =>
              users.findById(targetMember.user_id).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (user) =>
                      syncEvents.emitIfGuildLinked(
                        teamId,
                        'role_assigned',
                        payload.roleId,
                        role.name,
                        memberId,
                        user.discord_id,
                      ),
                  }),
                ),
                Effect.tapError((e) => Effect.logWarning('Failed to emit sync event', e)),
                Effect.catchAll(() => Effect.void),
              ),
            ),
            Effect.asVoid,
          ),
        )
        .handle('unassignRole', ({ path: { teamId, memberId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('targetMember', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('role', () =>
              roles.findRoleById(roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ role }) =>
              role.team_id !== teamId ? Effect.fail(new RoleApi.RoleNotFound()) : Effect.void,
            ),
            Effect.tap(() =>
              members.unassignRole(memberId, roleId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ targetMember, role }) =>
              notifications
                .insert(
                  teamId,
                  targetMember.user_id,
                  'role_removed',
                  `Role "${role.name}" removed`,
                  `You have been removed from the "${role.name}" role.`,
                )
                .pipe(
                  Effect.tapError((e) => Effect.logWarning('Failed to create notification', e)),
                  Effect.catchAll(() => Effect.void),
                ),
            ),
            Effect.tap(({ targetMember, role }) =>
              users.findById(targetMember.user_id).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (user) =>
                      syncEvents.emitIfGuildLinked(
                        teamId,
                        'role_unassigned',
                        roleId,
                        role.name,
                        memberId,
                        user.discord_id,
                      ),
                  }),
                ),
                Effect.tapError((e) => Effect.logWarning('Failed to emit sync event', e)),
                Effect.catchAll(() => Effect.void),
              ),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
