import { HttpApiBuilder } from '@effect/platform';
import { Auth, RoleApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

const forbidden = new RoleApi.Forbidden();

export const RoleApiLive = HttpApiBuilder.group(Api, 'role', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('roles', () => RolesRepository),
    Effect.map(({ members, roles }) =>
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
            Effect.tap(() => roles.deleteRoleById(roleId).pipe(Effect.mapError(() => forbidden))),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
