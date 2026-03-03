import { SqlClient, SqlSchema } from '@effect/sql';
import { Role, Team, TeamMember, User } from '@sideline/domain';
import { Bind, Schemas } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MembershipQuery extends Schema.Class<MembershipQuery>('MembershipQuery')({
  team_id: Schema.String,
  user_id: Schema.String,
}) {}

class RosterMemberQuery extends Schema.Class<RosterMemberQuery>('RosterMemberQuery')({
  team_id: Schema.String,
  member_id: Schema.String,
}) {}

class MemberRoleInput extends Schema.Class<MemberRoleInput>('MemberRoleInput')({
  team_member_id: Schema.String,
  role_id: Schema.String,
}) {}

export class MembershipWithRole extends Schema.Class<MembershipWithRole>('MembershipWithRole')({
  id: TeamMember.TeamMemberId,
  team_id: Team.TeamId,
  user_id: User.UserId,
  active: Schema.Boolean,
  role_names: Schemas.ArrayFromSplitString(),
  permissions: Schema.compose(Schemas.ArrayFromSplitString(), Schema.Array(Role.Permission)),
}) {}

export class RosterEntry extends Schema.Class<RosterEntry>('RosterEntry')({
  member_id: TeamMember.TeamMemberId,
  user_id: User.UserId,
  role_names: Schema.String,
  permissions: Schema.String,
  name: Schema.NullOr(Schema.String),
  birth_year: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(User.Gender),
  jersey_number: Schema.NullOr(Schema.Number),
  discord_username: Schema.String,
  discord_avatar: Schema.NullOr(Schema.String),
}) {}

export class TeamMembersRepository extends Effect.Service<TeamMembersRepository>()(
  'api/TeamMembersRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('addMember', ({ sql }) =>
        SqlSchema.single({
          Request: TeamMember.TeamMember.insert,
          Result: TeamMember.TeamMember,
          execute: (input) => sql`
            INSERT INTO team_members (team_id, user_id, active)
            VALUES (${input.team_id}, ${input.user_id}, ${input.active})
            RETURNING *
          `,
        }),
      ),
      Effect.let('assignRoleToMember', ({ sql }) =>
        SqlSchema.void({
          Request: MemberRoleInput,
          execute: (input) => sql`
            INSERT INTO member_roles (team_member_id, role_id)
            VALUES (${input.team_member_id}, ${input.role_id})
            ON CONFLICT DO NOTHING
          `,
        }),
      ),
      Effect.let('unassignRoleFromMember', ({ sql }) =>
        SqlSchema.void({
          Request: MemberRoleInput,
          execute: (input) => sql`
            DELETE FROM member_roles
            WHERE team_member_id = ${input.team_member_id} AND role_id = ${input.role_id}
          `,
        }),
      ),
      Effect.let('findMembership', ({ sql }) =>
        SqlSchema.findOne({
          Request: MembershipQuery,
          Result: MembershipWithRole,
          execute: (input) =>
            sql`SELECT tm.id, tm.team_id, tm.user_id, tm.active,
                       COALESCE(
                         (SELECT string_agg(DISTINCT r.name, ',' ORDER BY r.name) FROM (
                           SELECT r.name FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.team_member_id = tm.id
                           UNION
                           SELECT r.name FROM group_members gm
                           JOIN LATERAL (
                             WITH RECURSIVE ancestors AS (
                               SELECT gm.group_id AS id
                               UNION ALL
                               SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
                             )
                             SELECT id FROM ancestors
                           ) anc ON true
                           JOIN role_groups rg ON rg.group_id = anc.id
                           JOIN roles r ON r.id = rg.role_id
                           WHERE gm.team_member_id = tm.id
                         ) all_roles), ''
                       ) AS role_names,
                       COALESCE(
                         (SELECT string_agg(DISTINCT perm, ',') FROM (
                           SELECT rp.permission AS perm
                           FROM member_roles mr JOIN role_permissions rp ON rp.role_id = mr.role_id
                           WHERE mr.team_member_id = tm.id
                           UNION
                           SELECT rp.permission AS perm
                           FROM group_members gm
                           JOIN LATERAL (
                             WITH RECURSIVE ancestors AS (
                               SELECT gm.group_id AS id
                               UNION ALL
                               SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
                             )
                             SELECT id FROM ancestors
                           ) anc ON true
                           JOIN role_groups rg ON rg.group_id = anc.id
                           JOIN role_permissions rp ON rp.role_id = rg.role_id
                           WHERE gm.team_member_id = tm.id
                         ) all_perms), ''
                       ) AS permissions
                FROM team_members tm
                WHERE tm.team_id = ${input.team_id} AND tm.user_id = ${input.user_id}`,
        }),
      ),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMember.TeamMember,
          execute: (teamId) =>
            sql`SELECT * FROM team_members WHERE team_id = ${teamId} AND active = true`,
        }),
      ),
      Effect.let('findByUser', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: MembershipWithRole,
          execute: (userId) =>
            sql`SELECT tm.id, tm.team_id, tm.user_id, tm.active,
                       COALESCE(
                         (SELECT string_agg(DISTINCT r.name, ',' ORDER BY r.name) FROM (
                           SELECT r.name FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.team_member_id = tm.id
                           UNION
                           SELECT r.name FROM group_members gm
                           JOIN LATERAL (
                             WITH RECURSIVE ancestors AS (
                               SELECT gm.group_id AS id
                               UNION ALL
                               SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
                             )
                             SELECT id FROM ancestors
                           ) anc ON true
                           JOIN role_groups rg ON rg.group_id = anc.id
                           JOIN roles r ON r.id = rg.role_id
                           WHERE gm.team_member_id = tm.id
                         ) all_roles), ''
                       ) AS role_names,
                       COALESCE(
                         (SELECT string_agg(DISTINCT perm, ',') FROM (
                           SELECT rp.permission AS perm
                           FROM member_roles mr JOIN role_permissions rp ON rp.role_id = mr.role_id
                           WHERE mr.team_member_id = tm.id
                           UNION
                           SELECT rp.permission AS perm
                           FROM group_members gm
                           JOIN LATERAL (
                             WITH RECURSIVE ancestors AS (
                               SELECT gm.group_id AS id
                               UNION ALL
                               SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
                             )
                             SELECT id FROM ancestors
                           ) anc ON true
                           JOIN role_groups rg ON rg.group_id = anc.id
                           JOIN role_permissions rp ON rp.role_id = rg.role_id
                           WHERE gm.team_member_id = tm.id
                         ) all_perms), ''
                       ) AS permissions
                FROM team_members tm
                WHERE tm.user_id = ${userId}`,
        }),
      ),
      Effect.let('findRosterByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: RosterEntry,
          execute: (teamId) => sql`
            SELECT tm.id as member_id, tm.user_id,
                   COALESCE(
                     (SELECT string_agg(DISTINCT r.name, ',' ORDER BY r.name)
                      FROM member_roles mr JOIN roles r ON r.id = mr.role_id
                      WHERE mr.team_member_id = tm.id), ''
                   ) AS role_names,
                   COALESCE(
                     (SELECT string_agg(DISTINCT rp.permission, ',')
                      FROM member_roles mr JOIN role_permissions rp ON rp.role_id = mr.role_id
                      WHERE mr.team_member_id = tm.id), ''
                   ) AS permissions,
                   u.name, u.birth_year, u.gender, tm.jersey_number,
                   u.discord_username, u.discord_avatar
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${teamId} AND tm.active = true
          `,
        }),
      ),
      Effect.let('findRosterMember', ({ sql }) =>
        SqlSchema.findOne({
          Request: RosterMemberQuery,
          Result: RosterEntry,
          execute: (input) => sql`
            SELECT tm.id as member_id, tm.user_id,
                   COALESCE(
                     (SELECT string_agg(DISTINCT r.name, ',' ORDER BY r.name)
                      FROM member_roles mr JOIN roles r ON r.id = mr.role_id
                      WHERE mr.team_member_id = tm.id), ''
                   ) AS role_names,
                   COALESCE(
                     (SELECT string_agg(DISTINCT rp.permission, ',')
                      FROM member_roles mr JOIN role_permissions rp ON rp.role_id = mr.role_id
                      WHERE mr.team_member_id = tm.id), ''
                   ) AS permissions,
                   u.name, u.birth_year, u.gender, tm.jersey_number,
                   u.discord_username, u.discord_avatar
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${input.team_id} AND tm.id = ${input.member_id} AND tm.active = true
          `,
        }),
      ),
      Effect.let('deactivateMember', ({ sql }) =>
        SqlSchema.single({
          Request: RosterMemberQuery,
          Result: TeamMember.TeamMember,
          execute: (input) => sql`
            UPDATE team_members SET active = false
            WHERE id = ${input.member_id} AND team_id = ${input.team_id}
            RETURNING *
          `,
        }),
      ),
      Effect.let('updateJerseyNumber', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.Struct({
            member_id: TeamMember.TeamMemberId,
            jersey_number: Schema.NullOr(Schema.Number),
          }),
          execute: (input) => sql`
            UPDATE team_members SET jersey_number = ${input.jersey_number}
            WHERE id = ${input.member_id}
          `,
        }),
      ),
      Effect.let('findPlayerRoleId', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: Schema.Struct({ id: Role.RoleId }),
          execute: (teamId) =>
            sql`SELECT id FROM roles WHERE team_id = ${teamId} AND name = 'Player' AND is_built_in = true`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findMembershipByIds(teamId: Team.TeamId, userId: User.UserId) {
    return this.findMembership({ team_id: teamId, user_id: userId });
  }

  findRosterMemberByIds(teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) {
    return this.findRosterMember({ team_id: teamId, member_id: memberId });
  }

  deactivateMemberByIds(teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) {
    return this.deactivateMember({ team_id: teamId, member_id: memberId });
  }

  getPlayerRoleId(teamId: Team.TeamId) {
    return this.findPlayerRoleId(teamId);
  }

  assignRole(teamMemberId: TeamMember.TeamMemberId, roleId: Role.RoleId) {
    return this.assignRoleToMember({ team_member_id: teamMemberId, role_id: roleId });
  }

  unassignRole(teamMemberId: TeamMember.TeamMemberId, roleId: Role.RoleId) {
    return this.unassignRoleFromMember({ team_member_id: teamMemberId, role_id: roleId });
  }

  setJerseyNumber(memberId: TeamMember.TeamMemberId, jerseyNumber: number | null) {
    return this.updateJerseyNumber({ member_id: memberId, jersey_number: jerseyNumber });
  }
}
