import { SqlClient, SqlSchema } from '@effect/sql';
import { Role, Team, TeamMember, User } from '@sideline/domain';
import { Schemas, SqlErrors } from '@sideline/effect-lib';
import { Effect, type Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

export class MemberAlreadyExistsError extends Schema.TaggedError<MemberAlreadyExistsError>()(
  'MemberAlreadyExistsError',
  {},
) {}

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
  discord_id: Schema.String,
  role_names: Schemas.ArrayFromSplitString(),
  permissions: Schema.compose(Schemas.ArrayFromSplitString(), Schema.Array(Role.Permission)),
  name: Schema.OptionFromNullOr(Schema.String),
  birth_date: Schema.OptionFromNullOr(Schema.String),
  gender: Schema.OptionFromNullOr(User.Gender),
  jersey_number: Schema.OptionFromNullOr(Schema.Number),
  username: Schema.String,
  avatar: Schema.OptionFromNullOr(Schema.String),
}) {}

export class TeamMembersRepository extends Effect.Service<TeamMembersRepository>()(
  'api/TeamMembersRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private addMemberQuery = SqlSchema.single({
    Request: TeamMember.TeamMember.insert,
    Result: TeamMember.TeamMember,
    execute: (input) => this.sql`
      INSERT INTO team_members (team_id, user_id, active)
      VALUES (${input.team_id}, ${input.user_id}, ${input.active})
      RETURNING *
    `,
  });

  addMember = (input: typeof TeamMember.TeamMember.insert.Type) =>
    this.addMemberQuery(input).pipe(
      SqlErrors.catchUniqueViolation(() => new MemberAlreadyExistsError()),
      catchSqlErrors,
    );

  private assignRoleToMemberQuery = SqlSchema.void({
    Request: MemberRoleInput,
    execute: (input) => this.sql`
      INSERT INTO member_roles (team_member_id, role_id)
      VALUES (${input.team_member_id}, ${input.role_id})
      ON CONFLICT DO NOTHING
    `,
  });

  private unassignRoleFromMemberQuery = SqlSchema.void({
    Request: MemberRoleInput,
    execute: (input) => this.sql`
      DELETE FROM member_roles
      WHERE team_member_id = ${input.team_member_id} AND role_id = ${input.role_id}
    `,
  });

  private findMembershipQuery = SqlSchema.findOne({
    Request: MembershipQuery,
    Result: MembershipWithRole,
    execute: (input) =>
      this.sql`SELECT tm.id, tm.team_id, tm.user_id, tm.active,
                   COALESCE(
                     (SELECT string_agg(DISTINCT name, ',' ORDER BY name) FROM (
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
  });

  private findByTeamQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: TeamMember.TeamMember,
    execute: (teamId) =>
      this.sql`SELECT * FROM team_members WHERE team_id = ${teamId} AND active = true`,
  });

  findByTeam = (teamId: string) => this.findByTeamQuery(teamId).pipe(catchSqlErrors);

  private findByUserQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: MembershipWithRole,
    execute: (userId) =>
      this.sql`SELECT tm.id, tm.team_id, tm.user_id, tm.active,
                   COALESCE(
                     (SELECT string_agg(DISTINCT name, ',' ORDER BY name) FROM (
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
  });

  findByUser = (userId: string) => this.findByUserQuery(userId).pipe(catchSqlErrors);

  private findRosterByTeamQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: RosterEntry,
    execute: (teamId) => this.sql`
      SELECT tm.id as member_id, tm.user_id, u.discord_id,
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
             u.name, u.birth_date::text AS birth_date, u.gender, tm.jersey_number,
             u.username, u.avatar
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ${teamId} AND tm.active = true
    `,
  });

  findRosterByTeam = (teamId: string) => this.findRosterByTeamQuery(teamId).pipe(catchSqlErrors);

  private findRosterMemberQuery = SqlSchema.findOne({
    Request: RosterMemberQuery,
    Result: RosterEntry,
    execute: (input) => this.sql`
      SELECT tm.id as member_id, tm.user_id, u.discord_id,
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
             u.name, u.birth_date::text AS birth_date, u.gender, tm.jersey_number,
             u.username, u.avatar
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ${input.team_id} AND tm.id = ${input.member_id} AND tm.active = true
    `,
  });

  private deactivateMemberQuery = SqlSchema.single({
    Request: RosterMemberQuery,
    Result: TeamMember.TeamMember,
    execute: (input) => this.sql`
      UPDATE team_members SET active = false
      WHERE id = ${input.member_id} AND team_id = ${input.team_id}
      RETURNING *
    `,
  });

  private updateJerseyNumberQuery = SqlSchema.void({
    Request: Schema.Struct({
      member_id: TeamMember.TeamMemberId,
      jersey_number: Schema.OptionFromNullOr(Schema.Number),
    }),
    execute: (input) => this.sql`
      UPDATE team_members SET jersey_number = ${input.jersey_number}
      WHERE id = ${input.member_id}
    `,
  });

  private findPlayerRoleIdQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: Schema.Struct({ id: Role.RoleId }),
    execute: (teamId) =>
      this
        .sql`SELECT id FROM roles WHERE team_id = ${teamId} AND name = 'Player' AND is_built_in = true`,
  });

  findMembershipByIds = (teamId: Team.TeamId, userId: User.UserId) =>
    this.findMembershipQuery({ team_id: teamId, user_id: userId }).pipe(catchSqlErrors);

  findRosterMemberByIds = (teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) =>
    this.findRosterMemberQuery({ team_id: teamId, member_id: memberId }).pipe(catchSqlErrors);

  deactivateMemberByIds = (teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) =>
    this.deactivateMemberQuery({ team_id: teamId, member_id: memberId }).pipe(catchSqlErrors);

  getPlayerRoleId = (teamId: Team.TeamId) =>
    this.findPlayerRoleIdQuery(teamId).pipe(catchSqlErrors);

  assignRole = (teamMemberId: TeamMember.TeamMemberId, roleId: Role.RoleId) =>
    this.assignRoleToMemberQuery({ team_member_id: teamMemberId, role_id: roleId }).pipe(
      catchSqlErrors,
    );

  unassignRole = (teamMemberId: TeamMember.TeamMemberId, roleId: Role.RoleId) =>
    this.unassignRoleFromMemberQuery({ team_member_id: teamMemberId, role_id: roleId }).pipe(
      catchSqlErrors,
    );

  setJerseyNumber = (memberId: TeamMember.TeamMemberId, jerseyNumber: Option.Option<number>) =>
    this.updateJerseyNumberQuery({ member_id: memberId, jersey_number: jerseyNumber }).pipe(
      catchSqlErrors,
    );
}
