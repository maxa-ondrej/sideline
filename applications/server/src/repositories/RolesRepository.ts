import { SqlClient, SqlSchema } from '@effect/sql';
import { Role as RoleNS, Team as TeamNS } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class RoleWithPermissionCount extends Schema.Class<RoleWithPermissionCount>(
  'RoleWithPermissionCount',
)({
  id: RoleNS.RoleId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
  is_built_in: Schema.Boolean,
  permission_count: Schema.Number,
}) {}

class RoleRow extends Schema.Class<RoleRow>('RoleRow')({
  id: RoleNS.RoleId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
  is_built_in: Schema.Boolean,
}) {}

class PermissionRow extends Schema.Class<PermissionRow>('PermissionRow')({
  permission: RoleNS.Permission,
}) {}

class RoleInsertInput extends Schema.Class<RoleInsertInput>('RoleInsertInput')({
  team_id: Schema.String,
  name: Schema.String,
  is_built_in: Schema.Boolean,
}) {}

class RoleUpdateInput extends Schema.Class<RoleUpdateInput>('RoleUpdateInput')({
  id: RoleNS.RoleId,
  name: Schema.NullOr(Schema.String),
}) {}

class InsertPermissionInput extends Schema.Class<InsertPermissionInput>('InsertPermissionInput')({
  role_id: RoleNS.RoleId,
  permission: RoleNS.Permission,
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
            WHERE r.team_id = ${teamId}
            ORDER BY r.is_built_in DESC, r.name ASC
          `,
      }),
    ),
    Effect.let('findById', ({ sql }) =>
      SqlSchema.findOne({
        Request: RoleNS.RoleId,
        Result: RoleRow,
        execute: (id) => sql`SELECT id, team_id, name, is_built_in FROM roles WHERE id = ${id}`,
      }),
    ),
    Effect.let('findPermissions', ({ sql }) =>
      SqlSchema.findAll({
        Request: RoleNS.RoleId,
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
    Effect.let('deleteRole', ({ sql }) =>
      SqlSchema.void({
        Request: RoleNS.RoleId,
        execute: (id) => sql`DELETE FROM roles WHERE id = ${id}`,
      }),
    ),
    Effect.let('deletePermissions', ({ sql }) =>
      SqlSchema.void({
        Request: RoleNS.RoleId,
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
          sql`SELECT id, team_id, name, is_built_in FROM roles WHERE team_id = ${input.team_id} AND name = ${input.name}`,
      }),
    ),
    Effect.let('countMembersForRole', ({ sql }) =>
      SqlSchema.single({
        Request: RoleNS.RoleId,
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
    Bind.remove('sql'),
  ),
}) {
  findRolesByTeamId(teamId: TeamNS.TeamId) {
    return this.findByTeamId(teamId);
  }

  findRoleById(roleId: RoleNS.RoleId) {
    return this.findById(roleId);
  }

  getPermissionsForRoleId(roleId: RoleNS.RoleId) {
    return this.findPermissions(roleId).pipe(Effect.map((rows) => rows.map((r) => r.permission)));
  }

  insertRole(teamId: TeamNS.TeamId, name: string) {
    return this.insert({ team_id: teamId, name, is_built_in: false });
  }

  updateRole(roleId: RoleNS.RoleId, name: string | null) {
    return this.update({ id: roleId, name });
  }

  deleteRoleById(roleId: RoleNS.RoleId) {
    return this.deleteRole(roleId);
  }

  setRolePermissions(roleId: RoleNS.RoleId, permissions: ReadonlyArray<RoleNS.Permission>) {
    return this.deletePermissions(roleId).pipe(
      Effect.flatMap(() =>
        Effect.all(
          permissions.map((p) => this.insertPermission({ role_id: roleId, permission: p })),
        ),
      ),
      Effect.asVoid,
    );
  }

  initializeTeamRoles(teamId: TeamNS.TeamId) {
    return this.initTeamRoles({ team_id: teamId });
  }

  findRoleByTeamAndName(teamId: TeamNS.TeamId, name: string) {
    return this.findByTeamAndName({ team_id: teamId, name });
  }

  seedTeamRolesWithPermissions(teamId: TeamNS.TeamId) {
    return this.initializeTeamRoles(teamId).pipe(
      Effect.flatMap(() => this.findByTeamId(teamId)),
      Effect.tap((roles) =>
        Effect.all(
          roles.map((role) => {
            const perms = RoleNS.defaultPermissions[role.name];
            return perms ? this.setRolePermissions(role.id, perms) : Effect.void;
          }),
        ),
      ),
    );
  }

  getMemberCountForRole(roleId: RoleNS.RoleId) {
    return this.countMembersForRole(roleId).pipe(Effect.map((r) => r.count));
  }
}
