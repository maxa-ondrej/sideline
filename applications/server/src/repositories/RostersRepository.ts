import { Model, SqlClient, SqlSchema } from '@effect/sql';
import {
  RosterModel as RosterNS,
  TeamMember as TeamMemberNS,
  Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';
import { RosterEntry } from '~/repositories/TeamMembersRepository.js';

class RosterWithCount extends Schema.Class<RosterWithCount>('RosterWithCount')({
  id: RosterNS.RosterId,
  team_id: TeamNS.TeamId,
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
  id: RosterNS.RosterId,
  name: Schema.NullOr(Schema.String),
  active: Schema.NullOr(Schema.Boolean),
}) {}

class RosterMemberInput extends Schema.Class<RosterMemberInput>('RosterMemberInput')({
  roster_id: RosterNS.RosterId,
  team_member_id: TeamMemberNS.TeamMemberId,
}) {}

class RosterMemberEntriesInput extends Schema.Class<RosterMemberEntriesInput>(
  'RosterMemberEntriesInput',
)({
  roster_id: RosterNS.RosterId,
}) {}

export class RostersRepository extends Effect.Service<RostersRepository>()(
  'api/RostersRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: RosterWithCount,
          execute: (teamId) => sql`
            SELECT r.id, r.team_id, r.name, r.active, r.created_at,
                   (SELECT COUNT(*) FROM roster_members rm WHERE rm.roster_id = r.id)::int AS member_count
            FROM rosters r
            WHERE r.team_id = ${teamId}
            ORDER BY r.created_at DESC
          `,
        }),
      ),
      Effect.let('findById', ({ sql }) =>
        SqlSchema.findOne({
          Request: RosterNS.RosterId,
          Result: RosterNS.Roster,
          execute: (id) => sql`SELECT * FROM rosters WHERE id = ${id}`,
        }),
      ),
      Effect.let('insert', ({ sql }) =>
        SqlSchema.single({
          Request: RosterInsertInput,
          Result: RosterNS.Roster,
          execute: (input) => sql`
            INSERT INTO rosters (team_id, name, active)
            VALUES (${input.team_id}, ${input.name}, ${input.active})
            RETURNING *
          `,
        }),
      ),
      Effect.let('update', ({ sql }) =>
        SqlSchema.single({
          Request: RosterUpdateInput,
          Result: RosterNS.Roster,
          execute: (input) => sql`
            UPDATE rosters
            SET name = COALESCE(${input.name}, name),
                active = COALESCE(${input.active}, active)
            WHERE id = ${input.id}
            RETURNING *
          `,
        }),
      ),
      Effect.let('delete', ({ sql }) =>
        SqlSchema.void({
          Request: RosterNS.RosterId,
          execute: (id) => sql`DELETE FROM rosters WHERE id = ${id}`,
        }),
      ),
      Effect.let('findMemberEntries', ({ sql }) =>
        SqlSchema.findAll({
          Request: RosterMemberEntriesInput,
          Result: RosterEntry,
          execute: (input) => sql`
            SELECT tm.id AS member_id, tm.user_id, tm.role,
                   u.name, u.birth_year, u.gender, u.jersey_number, u.position,
                   u.proficiency, u.discord_username, u.discord_avatar
            FROM roster_members rmb
            JOIN team_members tm ON tm.id = rmb.team_member_id
            JOIN users u ON u.id = tm.user_id
            WHERE rmb.roster_id = ${input.roster_id}
          `,
        }),
      ),
      Effect.let('addMember', ({ sql }) =>
        SqlSchema.void({
          Request: RosterMemberInput,
          execute: (input) => sql`
            INSERT INTO roster_members (roster_id, team_member_id)
            VALUES (${input.roster_id}, ${input.team_member_id})
            ON CONFLICT DO NOTHING
          `,
        }),
      ),
      Effect.let('removeMember', ({ sql }) =>
        SqlSchema.void({
          Request: RosterMemberInput,
          execute: (input) => sql`
            DELETE FROM roster_members
            WHERE roster_id = ${input.roster_id} AND team_member_id = ${input.team_member_id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findByTeamId(teamId: TeamNS.TeamId) {
    return this.findByTeam(teamId);
  }

  findRosterById(rosterId: RosterNS.RosterId) {
    return this.findById(rosterId);
  }

  addMemberById(rosterId: RosterNS.RosterId, teamMemberId: TeamMemberNS.TeamMemberId) {
    return this.addMember({ roster_id: rosterId, team_member_id: teamMemberId });
  }

  removeMemberById(rosterId: RosterNS.RosterId, teamMemberId: TeamMemberNS.TeamMemberId) {
    return this.removeMember({ roster_id: rosterId, team_member_id: teamMemberId });
  }

  findMemberEntriesById(rosterId: RosterNS.RosterId) {
    return this.findMemberEntries({ roster_id: rosterId });
  }
}
