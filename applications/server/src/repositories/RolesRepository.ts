import { SqlClient, SqlSchema } from '@effect/sql';
import { GroupModel, Role, Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class RoleWithPermissionCount extends Schema.Class<RoleWithPermissionCount>(
  'RoleWithPermissionCount',
)({
  id: Role.RoleId,
  team_id: Team.TeamId,
  name: Schema.String,
  is_built_in: Schema.Boolean,
  permission_count: Schema.Number,
}) {}

class RoleRow extends Schema.Class<RoleRow>('RoleRow')({
  id: Role.RoleId,
  team_id: Team.TeamId,
  name: Schema.String,
  is_built_in: Schema.Boolean,
}) {}

class PermissionRow extends Schema.Class<PermissionRow>('PermissionRow')({
  permission: Role.Permission,
}) {}

class RoleInsertInput extends Schema.Class<RoleInsertInput>('RoleInsertInput')({
  team_id: Schema.String,
  name: Schema.String,
  is_built_in: Schema.Boolean,
}) {}

class RoleUpdateInput extends Schema.Class<RoleUpdateInput>('RoleUpdateInput')({
  id: Role.RoleId,
  name: Schema.NullOr(Schema.String),
}) {}

class InsertPermissionInput extends Schema.Class<InsertPermissionInput>('InsertPermissionInput')({
  role_id: Role.RoleId,
  permission: Role.Permission,
}) {}

class FindByTeamAndNameInput extends Schema.Class<FindByTeamAndNameInput>('FindByTeamAndNameInput')(
  {
    team_id: Schema.String,
    name: Schema.String,
  },
) {}

class InitTeamRolesInput extends Schema.Class<InitTeamRolesInput>('InitTeamRolesInput')({
  team_id: Schema.String,
}) {}

class RoleGroupInput extends Schema.Class<RoleGroupInput>('RoleGroupInput')({
  role_id: Role.RoleId,
  group_id: GroupModel.GroupId,
}) {}

class RoleGroupRow extends Schema.Class<RoleGroupRow>('RoleGroupRow')({
  group_id: GroupModel.GroupId,
  group_name: Schema.String,
}) {}

export class RolesRepository extends Effect.Service<RolesRepository>()('api/RolesRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.let('findByTeamId', ({ sql }) =>
      SqlSchema.findAll({
        Request: Schema.String,
        Result: RoleWithPermissionCount,
        execute: (teamId) => sql`
            SELECT r.id, r.team_id, r.name, r.is_built_in,
                   (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id)::int AS permission_count
            FROM roles r
            WHERE r.team_id = ${teamId} AND r.is_archived = false
            ORDER BY r.is_built_in DESC, r.name ASC
          `,
      }),
    ),
    Effect.let('findById', ({ sql }) =>
      SqlSchema.findOne({
        Request: Role.RoleId,
        Result: RoleRow,
        execute: (id) =>
          sql`SELECT id, team_id, name, is_built_in FROM roles WHERE id = ${id} AND is_archived = false`,
      }),
    ),
    Effect.let('findPermissions', ({ sql }) =>
      SqlSchema.findAll({
        Request: Role.RoleId,
        Result: PermissionRow,
        execute: (roleId) => sql`SELECT permission FROM role_permissions WHERE role_id = ${roleId}`,
      }),
    ),
    Effect.let('insert', ({ sql }) =>
      SqlSchema.single({
        Request: RoleInsertInput,
        Result: RoleRow,
        execute: (input) => sql`
            INSERT INTO roles (team_id, name, is_built_in)
            VALUES (${input.team_id}, ${input.name}, ${input.is_built_in})
            RETURNING id, team_id, name, is_built_in
          `,
      }),
    ),
    Effect.let('update', ({ sql }) =>
      SqlSchema.single({
        Request: RoleUpdateInput,
        Result: RoleRow,
        execute: (input) => sql`
            UPDATE roles
            SET name = COALESCE(${input.name}, name)
            WHERE id = ${input.id}
            RETURNING id, team_id, name, is_built_in
          `,
      }),
    ),
    Effect.let('archiveRole', ({ sql }) =>
      SqlSchema.void({
        Request: Role.RoleId,
        execute: (id) => sql`UPDATE roles SET is_archived = true WHERE id = ${id}`,
      }),
    ),
    Effect.let('deletePermissions', ({ sql }) =>
      SqlSchema.void({
        Request: Role.RoleId,
        execute: (roleId) => sql`DELETE FROM role_permissions WHERE role_id = ${roleId}`,
      }),
    ),
    Effect.let('insertPermission', ({ sql }) =>
      SqlSchema.void({
        Request: InsertPermissionInput,
        execute: (input) => sql`
            INSERT INTO role_permissions (role_id, permission)
            VALUES (${input.role_id}, ${input.permission})
            ON CONFLICT DO NOTHING
          `,
      }),
    ),
    Effect.let('findByTeamAndName', ({ sql }) =>
      SqlSchema.findOne({
        Request: FindByTeamAndNameInput,
        Result: RoleRow,
        execute: (input) =>
          sql`SELECT id, team_id, name, is_built_in FROM roles WHERE team_id = ${input.team_id} AND name = ${input.name} AND is_archived = false`,
      }),
    ),
    Effect.let('countMembersForRole', ({ sql }) =>
      SqlSchema.single({
        Request: Role.RoleId,
        Result: Schema.Struct({ count: Schema.Number }),
        execute: (roleId) =>
          sql`SELECT COUNT(*)::int AS count FROM member_roles WHERE role_id = ${roleId}`,
      }),
    ),
    Effect.let('initTeamRoles', ({ sql }) =>
      SqlSchema.void({
        Request: InitTeamRolesInput,
        execute: (input) => sql`
            INSERT INTO roles (team_id, name, is_built_in)
            VALUES
              (${input.team_id}, 'Admin', true),
              (${input.team_id}, 'Captain', true),
              (${input.team_id}, 'Player', true)
            ON CONFLICT (team_id, name) DO NOTHING
          `,
      }),
    ),
    Effect.let('findGroupsForRoleId', ({ sql }) =>
      SqlSchema.findAll({
        Request: Role.RoleId,
        Result: RoleGroupRow,
        execute: (roleId) => sql`
            SELECT g.id AS group_id, g.name AS group_name
            FROM role_groups rg
            JOIN groups g ON g.id = rg.group_id
            WHERE rg.role_id = ${roleId}
            ORDER BY g.name ASC
          `,
      }),
    ),
    Effect.let('assignRoleGroup', ({ sql }) =>
      SqlSchema.void({
        Request: RoleGroupInput,
        execute: (input) => sql`
            INSERT INTO role_groups (role_id, group_id)
            VALUES (${input.role_id}, ${input.group_id})
            ON CONFLICT DO NOTHING
          `,
      }),
    ),
    Effect.let('unassignRoleGroup', ({ sql }) =>
      SqlSchema.void({
        Request: RoleGroupInput,
        execute: (input) => sql`
            DELETE FROM role_groups
            WHERE role_id = ${input.role_id} AND group_id = ${input.group_id}
          `,
      }),
    ),
    Bind.remove('sql'),
  ),
}) {
  findRolesByTeamId(teamId: Team.TeamId) {
    return this.findByTeamId(teamId);
  }

  findRoleById(roleId: Role.RoleId) {
    return this.findById(roleId);
  }

  getPermissionsForRoleId(roleId: Role.RoleId) {
    return this.findPermissions(roleId).pipe(Effect.map((rows) => rows.map((r) => r.permission)));
  }

  insertRole(teamId: Team.TeamId, name: string) {
    return this.insert({ team_id: teamId, name, is_built_in: false });
  }

  updateRole(roleId: Role.RoleId, name: string | null) {
    return this.update({ id: roleId, name });
  }

  archiveRoleById(roleId: Role.RoleId) {
    return this.archiveRole(roleId);
  }

  setRolePermissions(roleId: Role.RoleId, permissions: ReadonlyArray<Role.Permission>) {
    return this.deletePermissions(roleId).pipe(
      Effect.flatMap(() =>
        Effect.all(
          permissions.map((p) => this.insertPermission({ role_id: roleId, permission: p })),
        ),
      ),
      Effect.asVoid,
    );
  }

  initializeTeamRoles(teamId: Team.TeamId) {
    return this.initTeamRoles({ team_id: teamId });
  }

  findRoleByTeamAndName(teamId: Team.TeamId, name: string) {
    return this.findByTeamAndName({ team_id: teamId, name });
  }

  seedTeamRolesWithPermissions(teamId: Team.TeamId) {
    return this.initializeTeamRoles(teamId).pipe(
      Effect.flatMap(() => this.findByTeamId(teamId)),
      Effect.tap((roles) =>
        Effect.all(
          roles.map((role) => {
            const perms = Role.defaultPermissions[role.name];
            return perms ? this.setRolePermissions(role.id, perms) : Effect.void;
          }),
        ),
      ),
    );
  }

  getMemberCountForRole(roleId: Role.RoleId) {
    return this.countMembersForRole(roleId).pipe(Effect.map((r) => r.count));
  }

  findGroupsForRole(roleId: Role.RoleId) {
    return this.findGroupsForRoleId(roleId);
  }

  assignRoleToGroup(roleId: Role.RoleId, groupId: GroupModel.GroupId) {
    return this.assignRoleGroup({ role_id: roleId, group_id: groupId });
  }

  unassignRoleFromGroup(roleId: Role.RoleId, groupId: GroupModel.GroupId) {
    return this.unassignRoleGroup({ role_id: roleId, group_id: groupId });
  }
}
