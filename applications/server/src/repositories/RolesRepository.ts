import { SqlClient, SqlSchema } from '@effect/sql';
import { GroupModel, Role, Team } from '@sideline/domain';
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
  effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
}) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: RoleWithPermissionCount,
    execute: (teamId) => this.sql`
      SELECT r.id, r.team_id, r.name, r.is_built_in,
             (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id)::int AS permission_count
      FROM roles r
      WHERE r.team_id = ${teamId} AND r.is_archived = false
      ORDER BY r.is_built_in DESC, r.name ASC
    `,
  });

  private findById = SqlSchema.findOne({
    Request: Role.RoleId,
    Result: RoleRow,
    execute: (id) =>
      this
        .sql`SELECT id, team_id, name, is_built_in FROM roles WHERE id = ${id} AND is_archived = false`,
  });

  private findPermissions = SqlSchema.findAll({
    Request: Role.RoleId,
    Result: PermissionRow,
    execute: (roleId) =>
      this.sql`SELECT permission FROM role_permissions WHERE role_id = ${roleId}`,
  });

  private insertQuery = SqlSchema.single({
    Request: RoleInsertInput,
    Result: RoleRow,
    execute: (input) => this.sql`
      INSERT INTO roles (team_id, name, is_built_in)
      VALUES (${input.team_id}, ${input.name}, ${input.is_built_in})
      RETURNING id, team_id, name, is_built_in
    `,
  });

  private updateQuery = SqlSchema.single({
    Request: RoleUpdateInput,
    Result: RoleRow,
    execute: (input) => this.sql`
      UPDATE roles
      SET name = COALESCE(${input.name}, name)
      WHERE id = ${input.id}
      RETURNING id, team_id, name, is_built_in
    `,
  });

  private archiveRoleQuery = SqlSchema.void({
    Request: Role.RoleId,
    execute: (id) => this.sql`UPDATE roles SET is_archived = true WHERE id = ${id}`,
  });

  private deletePermissions = SqlSchema.void({
    Request: Role.RoleId,
    execute: (roleId) => this.sql`DELETE FROM role_permissions WHERE role_id = ${roleId}`,
  });

  private insertPermission = SqlSchema.void({
    Request: InsertPermissionInput,
    execute: (input) => this.sql`
      INSERT INTO role_permissions (role_id, permission)
      VALUES (${input.role_id}, ${input.permission})
      ON CONFLICT DO NOTHING
    `,
  });

  private findByTeamAndName = SqlSchema.findOne({
    Request: FindByTeamAndNameInput,
    Result: RoleRow,
    execute: (input) =>
      this
        .sql`SELECT id, team_id, name, is_built_in FROM roles WHERE team_id = ${input.team_id} AND name = ${input.name} AND is_archived = false`,
  });

  private countMembersForRole = SqlSchema.single({
    Request: Role.RoleId,
    Result: Schema.Struct({ count: Schema.Number }),
    execute: (roleId) =>
      this.sql`SELECT COUNT(*)::int AS count FROM member_roles WHERE role_id = ${roleId}`,
  });

  private initTeamRoles = SqlSchema.void({
    Request: InitTeamRolesInput,
    execute: (input) => this.sql`
      INSERT INTO roles (team_id, name, is_built_in)
      VALUES
        (${input.team_id}, 'Admin', true),
        (${input.team_id}, 'Captain', true),
        (${input.team_id}, 'Player', true)
      ON CONFLICT (team_id, name) DO NOTHING
    `,
  });

  private findGroupsForRoleIdQuery = SqlSchema.findAll({
    Request: Role.RoleId,
    Result: RoleGroupRow,
    execute: (roleId) => this.sql`
      SELECT g.id AS group_id, g.name AS group_name
      FROM role_groups rg
      JOIN groups g ON g.id = rg.group_id
      WHERE rg.role_id = ${roleId}
      ORDER BY g.name ASC
    `,
  });

  private assignRoleGroupQuery = SqlSchema.void({
    Request: RoleGroupInput,
    execute: (input) => this.sql`
      INSERT INTO role_groups (role_id, group_id)
      VALUES (${input.role_id}, ${input.group_id})
      ON CONFLICT DO NOTHING
    `,
  });

  private unassignRoleGroupQuery = SqlSchema.void({
    Request: RoleGroupInput,
    execute: (input) => this.sql`
      DELETE FROM role_groups
      WHERE role_id = ${input.role_id} AND group_id = ${input.group_id}
    `,
  });

  findRolesByTeamId = (teamId: Team.TeamId) => this.findByTeamId(teamId).pipe(Effect.orDie);

  findRoleById = (roleId: Role.RoleId) => this.findById(roleId).pipe(Effect.orDie);

  getPermissionsForRoleId = (roleId: Role.RoleId) =>
    this.findPermissions(roleId).pipe(
      Effect.map((rows) => rows.map((r) => r.permission)),
      Effect.orDie,
    );

  insertRole = (teamId: Team.TeamId, name: string) =>
    this.insertQuery({ team_id: teamId, name, is_built_in: false }).pipe(Effect.orDie);

  updateRole = (roleId: Role.RoleId, name: string | null) =>
    this.updateQuery({ id: roleId, name }).pipe(Effect.orDie);

  archiveRoleById = (roleId: Role.RoleId) => this.archiveRoleQuery(roleId).pipe(Effect.orDie);

  setRolePermissions = (roleId: Role.RoleId, permissions: ReadonlyArray<Role.Permission>) =>
    this.deletePermissions(roleId).pipe(
      Effect.flatMap(() =>
        Effect.all(
          permissions.map((p) => this.insertPermission({ role_id: roleId, permission: p })),
        ),
      ),
      Effect.asVoid,
      Effect.orDie,
    );

  initializeTeamRoles = (teamId: Team.TeamId) =>
    this.initTeamRoles({ team_id: teamId }).pipe(Effect.orDie);

  findRoleByTeamAndName = (teamId: Team.TeamId, name: string) =>
    this.findByTeamAndName({ team_id: teamId, name }).pipe(Effect.orDie);

  seedTeamRolesWithPermissions = (teamId: Team.TeamId) =>
    this.initializeTeamRoles(teamId).pipe(
      Effect.flatMap(() => this.findByTeamId(teamId)),
      Effect.tap((roles) =>
        Effect.all(
          roles.map((role) => {
            const perms = Role.defaultPermissions[role.name];
            return perms ? this.setRolePermissions(role.id, perms) : Effect.void;
          }),
        ),
      ),
      Effect.orDie,
    );

  getMemberCountForRole = (roleId: Role.RoleId) =>
    this.countMembersForRole(roleId).pipe(
      Effect.map((r) => r.count),
      Effect.orDie,
    );

  findGroupsForRole = (roleId: Role.RoleId) =>
    this.findGroupsForRoleIdQuery(roleId).pipe(Effect.orDie);

  assignRoleToGroup = (roleId: Role.RoleId, groupId: GroupModel.GroupId) =>
    this.assignRoleGroupQuery({ role_id: roleId, group_id: groupId }).pipe(Effect.orDie);

  unassignRoleFromGroup = (roleId: Role.RoleId, groupId: GroupModel.GroupId) =>
    this.unassignRoleGroupQuery({ role_id: roleId, group_id: groupId }).pipe(Effect.orDie);
}
