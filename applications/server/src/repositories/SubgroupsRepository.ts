import { SqlClient, SqlSchema } from '@effect/sql';
import {
  Role as RoleNS,
  SubgroupModel as SubgroupNS,
  TeamMember as TeamMemberNS,
  Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class SubgroupWithCount extends Schema.Class<SubgroupWithCount>('SubgroupWithCount')({
  id: SubgroupNS.SubgroupId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
  created_at: Schema.DateFromSelf,
  member_count: Schema.Number,
}) {}

class SubgroupRow extends Schema.Class<SubgroupRow>('SubgroupRow')({
  id: SubgroupNS.SubgroupId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
}) {}

class SubgroupMemberRow extends Schema.Class<SubgroupMemberRow>('SubgroupMemberRow')({
  member_id: TeamMemberNS.TeamMemberId,
  name: Schema.NullOr(Schema.String),
  discord_username: Schema.String,
}) {}

class PermissionRow extends Schema.Class<PermissionRow>('SubgroupPermissionRow')({
  permission: RoleNS.Permission,
}) {}

class SubgroupInsertInput extends Schema.Class<SubgroupInsertInput>('SubgroupInsertInput')({
  team_id: Schema.String,
  name: Schema.String,
}) {}

class SubgroupUpdateInput extends Schema.Class<SubgroupUpdateInput>('SubgroupUpdateInput')({
  id: SubgroupNS.SubgroupId,
  name: Schema.String,
}) {}

class SubgroupMemberInput extends Schema.Class<SubgroupMemberInput>('SubgroupMemberInput')({
  subgroup_id: SubgroupNS.SubgroupId,
  team_member_id: TeamMemberNS.TeamMemberId,
}) {}

class InsertPermissionInput extends Schema.Class<InsertPermissionInput>(
  'SubgroupInsertPermissionInput',
)({
  subgroup_id: SubgroupNS.SubgroupId,
  permission: RoleNS.Permission,
}) {}

export class SubgroupsRepository extends Effect.Service<SubgroupsRepository>()(
  'api/SubgroupsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByTeamId', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: SubgroupWithCount,
          execute: (teamId) => sql`
            SELECT s.id, s.team_id, s.name, s.created_at,
                   (SELECT COUNT(*) FROM subgroup_members sm WHERE sm.subgroup_id = s.id)::int AS member_count
            FROM subgroups s
            WHERE s.team_id = ${teamId} AND s.is_archived = false
            ORDER BY s.name ASC
          `,
        }),
      ),
      Effect.let('findById', ({ sql }) =>
        SqlSchema.findOne({
          Request: SubgroupNS.SubgroupId,
          Result: SubgroupRow,
          execute: (id) =>
            sql`SELECT id, team_id, name FROM subgroups WHERE id = ${id} AND is_archived = false`,
        }),
      ),
      Effect.let('insert', ({ sql }) =>
        SqlSchema.single({
          Request: SubgroupInsertInput,
          Result: SubgroupRow,
          execute: (input) => sql`
            INSERT INTO subgroups (team_id, name)
            VALUES (${input.team_id}, ${input.name})
            RETURNING id, team_id, name
          `,
        }),
      ),
      Effect.let('update', ({ sql }) =>
        SqlSchema.single({
          Request: SubgroupUpdateInput,
          Result: SubgroupRow,
          execute: (input) => sql`
            UPDATE subgroups SET name = ${input.name}
            WHERE id = ${input.id}
            RETURNING id, team_id, name
          `,
        }),
      ),
      Effect.let('archiveSubgroup', ({ sql }) =>
        SqlSchema.void({
          Request: SubgroupNS.SubgroupId,
          execute: (id) => sql`UPDATE subgroups SET is_archived = true WHERE id = ${id}`,
        }),
      ),
      Effect.let('findMembers', ({ sql }) =>
        SqlSchema.findAll({
          Request: SubgroupNS.SubgroupId,
          Result: SubgroupMemberRow,
          execute: (subgroupId) => sql`
            SELECT tm.id AS member_id, u.name, u.discord_username
            FROM subgroup_members sm
            JOIN team_members tm ON tm.id = sm.team_member_id
            JOIN users u ON u.id = tm.user_id
            WHERE sm.subgroup_id = ${subgroupId}
            ORDER BY u.discord_username ASC
          `,
        }),
      ),
      Effect.let('addMember', ({ sql }) =>
        SqlSchema.void({
          Request: SubgroupMemberInput,
          execute: (input) => sql`
            INSERT INTO subgroup_members (subgroup_id, team_member_id)
            VALUES (${input.subgroup_id}, ${input.team_member_id})
            ON CONFLICT DO NOTHING
          `,
        }),
      ),
      Effect.let('removeMember', ({ sql }) =>
        SqlSchema.void({
          Request: SubgroupMemberInput,
          execute: (input) => sql`
            DELETE FROM subgroup_members
            WHERE subgroup_id = ${input.subgroup_id} AND team_member_id = ${input.team_member_id}
          `,
        }),
      ),
      Effect.let('findPermissions', ({ sql }) =>
        SqlSchema.findAll({
          Request: SubgroupNS.SubgroupId,
          Result: PermissionRow,
          execute: (subgroupId) =>
            sql`SELECT permission FROM subgroup_permissions WHERE subgroup_id = ${subgroupId}`,
        }),
      ),
      Effect.let('deletePermissions', ({ sql }) =>
        SqlSchema.void({
          Request: SubgroupNS.SubgroupId,
          execute: (subgroupId) =>
            sql`DELETE FROM subgroup_permissions WHERE subgroup_id = ${subgroupId}`,
        }),
      ),
      Effect.let('insertPermission', ({ sql }) =>
        SqlSchema.void({
          Request: InsertPermissionInput,
          execute: (input) => sql`
            INSERT INTO subgroup_permissions (subgroup_id, permission)
            VALUES (${input.subgroup_id}, ${input.permission})
            ON CONFLICT DO NOTHING
          `,
        }),
      ),
      Effect.let('countMembersForSubgroup', ({ sql }) =>
        SqlSchema.single({
          Request: SubgroupNS.SubgroupId,
          Result: Schema.Struct({ count: Schema.Number }),
          execute: (subgroupId) =>
            sql`SELECT COUNT(*)::int AS count FROM subgroup_members WHERE subgroup_id = ${subgroupId}`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findSubgroupsByTeamId(teamId: TeamNS.TeamId) {
    return this.findByTeamId(teamId);
  }

  findSubgroupById(subgroupId: SubgroupNS.SubgroupId) {
    return this.findById(subgroupId);
  }

  insertSubgroup(teamId: TeamNS.TeamId, name: string) {
    return this.insert({ team_id: teamId, name });
  }

  updateSubgroup(subgroupId: SubgroupNS.SubgroupId, name: string) {
    return this.update({ id: subgroupId, name });
  }

  archiveSubgroupById(subgroupId: SubgroupNS.SubgroupId) {
    return this.archiveSubgroup(subgroupId);
  }

  findMembersBySubgroupId(subgroupId: SubgroupNS.SubgroupId) {
    return this.findMembers(subgroupId);
  }

  addMemberById(subgroupId: SubgroupNS.SubgroupId, teamMemberId: TeamMemberNS.TeamMemberId) {
    return this.addMember({ subgroup_id: subgroupId, team_member_id: teamMemberId });
  }

  removeMemberById(subgroupId: SubgroupNS.SubgroupId, teamMemberId: TeamMemberNS.TeamMemberId) {
    return this.removeMember({ subgroup_id: subgroupId, team_member_id: teamMemberId });
  }

  getPermissionsForSubgroupId(subgroupId: SubgroupNS.SubgroupId) {
    return this.findPermissions(subgroupId).pipe(
      Effect.map((rows) => rows.map((r) => r.permission)),
    );
  }

  setSubgroupPermissions(
    subgroupId: SubgroupNS.SubgroupId,
    permissions: ReadonlyArray<RoleNS.Permission>,
  ) {
    return this.deletePermissions(subgroupId).pipe(
      Effect.flatMap(() =>
        Effect.all(
          permissions.map((p) => this.insertPermission({ subgroup_id: subgroupId, permission: p })),
        ),
      ),
      Effect.asVoid,
    );
  }

  getMemberCount(subgroupId: SubgroupNS.SubgroupId) {
    return this.countMembersForSubgroup(subgroupId).pipe(Effect.map((r) => r.count));
  }
}
