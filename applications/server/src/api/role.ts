import { Auth, RoleApi } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

const forbidden = new RoleApi.Forbidden();

export const RoleApiLive = HttpApiBuilder.group(Api, 'role', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository.asEffect()),
    Effect.bind('roles', () => RolesRepository.asEffect()),
    Effect.bind('notifications', () => NotificationsRepository.asEffect()),
    Effect.map(({ members, roles, notifications }) =>
      handlers
        .handle('listRoles', ({ params: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:view', forbidden)),
            Effect.let('canManage', ({ membership }) => hasPermission(membership, 'role:manage')),
            Effect.bind('roleList', () => roles.findRolesByTeamId(teamId)),
            Effect.map(
              ({ roleList, canManage }) =>
                new RoleApi.RoleListResponse({
                  canManage,
                  roles: Array.map(
                    roleList,
                    (r) =>
                      new RoleApi.RoleInfo({
                        roleId: r.id,
                        teamId: teamId,
                        name: r.name,
                        isBuiltIn: r.is_built_in,
                        permissionCount: r.permission_count,
                      }),
                  ),
                }),
            ),
          ),
        )
        .handle('createRole', ({ params: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('role', () => roles.insertRole(teamId, payload.name)),
            Effect.tap(({ role }) => roles.setRolePermissions(role.id, payload.permissions)),
            Effect.map(
              ({ role }) =>
                new RoleApi.RoleDetail({
                  roleId: role.id,
                  teamId: teamId,
                  name: role.name,
                  isBuiltIn: role.is_built_in,
                  permissions: [...payload.permissions],
                  canManage: true,
                }),
            ),
            Effect.catchTag('RoleNameAlreadyTakenError', () =>
              Effect.fail(new RoleApi.RoleNameAlreadyTaken()),
            ),
            Effect.catchTag(
              'NoSuchElementError',
              LogicError.withMessage(
                () => `Failed creating role "${payload.name}" — no row returned`,
              ),
            ),
          ),
        )
        .handle('getRole', ({ params: { teamId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:view', forbidden)),
            Effect.let('canManage', ({ membership }) => hasPermission(membership, 'role:manage')),
            Effect.bind('role', () =>
              roles.findRoleById(roleId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('permissions', ({ role }) => roles.getPermissionsForRoleId(role.id)),
            Effect.map(
              ({ role, permissions, canManage }) =>
                new RoleApi.RoleDetail({
                  roleId: role.id,
                  teamId: teamId,
                  name: role.name,
                  isBuiltIn: role.is_built_in,
                  permissions: [...permissions],
                  canManage,
                }),
            ),
          ),
        )
        .handle('updateRole', ({ params: { teamId, roleId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              roles.findRoleById(roleId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new RoleApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.is_built_in && Option.isSome(payload.name)
                ? Effect.fail(new RoleApi.CannotModifyBuiltIn())
                : Effect.void,
            ),
            Effect.bind('updated', ({ existing }) =>
              Option.match(payload.name, {
                onNone: () => Effect.succeed(existing),
                onSome: (name) => roles.updateRole(roleId, Option.some(name)),
              }),
            ),
            Effect.tap(() =>
              Option.match(payload.permissions, {
                onNone: () => Effect.void,
                onSome: (perms) => roles.setRolePermissions(roleId, perms),
              }),
            ),
            Effect.bind('permissions', () => roles.getPermissionsForRoleId(roleId)),
            Effect.map(
              ({ updated, permissions }) =>
                new RoleApi.RoleDetail({
                  roleId: updated.id,
                  teamId: teamId,
                  name: updated.name,
                  isBuiltIn: updated.is_built_in,
                  permissions: [...permissions],
                  canManage: true,
                }),
            ),
            Effect.catchTag('RoleNameAlreadyTakenError', () =>
              Effect.fail(new RoleApi.RoleNameAlreadyTaken()),
            ),
            Effect.catchTag(
              'NoSuchElementError',
              LogicError.withMessage(() => `Failed updating role ${roleId} — no row returned`),
            ),
          ),
        )
        .handle('deleteRole', ({ params: { teamId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              roles.findRoleById(roleId).pipe(
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
            Effect.bind('memberCount', () => roles.getMemberCountForRole(roleId)),
            Effect.tap(({ memberCount }) =>
              memberCount > 0 ? Effect.fail(new RoleApi.RoleInUse()) : Effect.void,
            ),
            Effect.tap(() => roles.archiveRoleById(roleId)),
            Effect.asVoid,
            Effect.catchTag(
              'NoSuchElementError',
              LogicError.withMessage(() => `Failed deleting role ${roleId} — no row returned`),
            ),
          ),
        )
        .handle('assignRole', ({ params: { teamId, memberId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('targetMember', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
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
            Effect.tap(() => members.assignRole(memberId, payload.roleId)),
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
                  Effect.tapError((e) =>
                    Effect.logWarning('Failed to create role-assigned notification', e),
                  ),
                  Effect.catchTag('NoSuchElementError', () => Effect.void),
                ),
            ),
            Effect.asVoid,
          ),
        )
        .handle('unassignRole', ({ params: { teamId, memberId, roleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('targetMember', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
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
            Effect.tap(() => members.unassignRole(memberId, roleId)),
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
                  Effect.catchTag('NoSuchElementError', (e) =>
                    Effect.logWarning('Failed to create role-removed notification', e),
                  ),
                ),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
