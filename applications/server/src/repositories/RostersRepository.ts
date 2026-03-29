import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { RosterModel, Team, TeamMember } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';
import { RosterEntry } from '~/repositories/TeamMembersRepository.js';

class RosterWithCount extends Schema.Class<RosterWithCount>('RosterWithCount')({
  id: RosterModel.RosterId,
  team_id: Team.TeamId,
  name: Schema.String,
  active: Schema.Boolean,
  created_at: Model.DateTimeFromDate,
  member_count: Schema.Number,
}) {}

class RosterInsertInput extends Schema.Class<RosterInsertInput>('RosterInsertInput')({
  team_id: Schema.String,
  name: Schema.String,
  active: Schema.Boolean,
}) {}

class RosterUpdateInput extends Schema.Class<RosterUpdateInput>('RosterUpdateInput')({
  id: RosterModel.RosterId,
  name: Schema.OptionFromNullOr(Schema.String),
  active: Schema.OptionFromNullOr(Schema.Boolean),
}) {}

class RosterMemberInput extends Schema.Class<RosterMemberInput>('RosterMemberInput')({
  roster_id: RosterModel.RosterId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

class RosterMemberEntriesInput extends Schema.Class<RosterMemberEntriesInput>(
  'RosterMemberEntriesInput',
)({
  roster_id: RosterModel.RosterId,
}) {}

export class RostersRepository extends Effect.Service<RostersRepository>()(
  'api/RostersRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByTeam = SqlSchema.findAll({
    Request: Schema.String,
    Result: RosterWithCount,
    execute: (teamId) => this.sql`
      SELECT r.id, r.team_id, r.name, r.active, r.created_at,
             (SELECT COUNT(*) FROM roster_members rm WHERE rm.roster_id = r.id)::int AS member_count
      FROM rosters r
      WHERE r.team_id = ${teamId}
      ORDER BY r.created_at DESC
    `,
  });

  private findById = SqlSchema.findOne({
    Request: RosterModel.RosterId,
    Result: RosterModel.Roster,
    execute: (id) => this.sql`SELECT * FROM rosters WHERE id = ${id}`,
  });

  private insertOne = SqlSchema.single({
    Request: RosterInsertInput,
    Result: RosterModel.Roster,
    execute: (input) => this.sql`
      INSERT INTO rosters (team_id, name, active)
      VALUES (${input.team_id}, ${input.name}, ${input.active})
      RETURNING *
    `,
  });

  private updateOne = SqlSchema.single({
    Request: RosterUpdateInput,
    Result: RosterModel.Roster,
    execute: (input) => this.sql`
      UPDATE rosters
      SET name = COALESCE(${input.name}, name),
          active = COALESCE(${input.active}, active)
      WHERE id = ${input.id}
      RETURNING *
    `,
  });

  private deleteOne = SqlSchema.void({
    Request: RosterModel.RosterId,
    execute: (id) => this.sql`DELETE FROM rosters WHERE id = ${id}`,
  });

  private findMemberEntries = SqlSchema.findAll({
    Request: RosterMemberEntriesInput,
    Result: RosterEntry,
    execute: (input) => this.sql`
      SELECT tm.id AS member_id, tm.user_id, u.discord_id,
             COALESCE(
               (SELECT string_agg(DISTINCT r.name, ',' ORDER BY r.name)
                FROM member_roles mr JOIN roles r ON r.id = mr.role_id
                WHERE mr.team_member_id = tm.id), ''
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
             ) AS permissions,
             u.name, u.birth_date::text AS birth_date, u.gender, tm.jersey_number,
             u.username, u.avatar
      FROM roster_members rmb
      JOIN team_members tm ON tm.id = rmb.team_member_id
      JOIN users u ON u.id = tm.user_id
      WHERE rmb.roster_id = ${input.roster_id}
    `,
  });

  private addMember = SqlSchema.void({
    Request: RosterMemberInput,
    execute: (input) => this.sql`
      INSERT INTO roster_members (roster_id, team_member_id)
      VALUES (${input.roster_id}, ${input.team_member_id})
      ON CONFLICT DO NOTHING
    `,
  });

  private removeMember = SqlSchema.void({
    Request: RosterMemberInput,
    execute: (input) => this.sql`
      DELETE FROM roster_members
      WHERE roster_id = ${input.roster_id} AND team_member_id = ${input.team_member_id}
    `,
  });

  findByTeamId = (teamId: Team.TeamId) =>
    this.findByTeam(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  findRosterById = (rosterId: RosterModel.RosterId) =>
    this.findById(rosterId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  insert = (input: RosterInsertInput) =>
    this.insertOne(input).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  update = (input: RosterUpdateInput) =>
    this.updateOne(input).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  delete = (id: RosterModel.RosterId) =>
    this.deleteOne(id).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  addMemberById = (rosterId: RosterModel.RosterId, teamMemberId: TeamMember.TeamMemberId) =>
    this.addMember({ roster_id: rosterId, team_member_id: teamMemberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  removeMemberById = (rosterId: RosterModel.RosterId, teamMemberId: TeamMember.TeamMemberId) =>
    this.removeMember({ roster_id: rosterId, team_member_id: teamMemberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  findMemberEntriesById = (rosterId: RosterModel.RosterId) =>
    this.findMemberEntries({ roster_id: rosterId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );
}
