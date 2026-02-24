import { SqlClient, SqlSchema } from '@effect/sql';
import { TeamMember as TeamMemberNS, type Team as TeamNS, User as UserNS } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MembershipQuery extends Schema.Class<MembershipQuery>('MembershipQuery')({
  team_id: Schema.String,
  user_id: Schema.String,
}) {}

class RosterMemberQuery extends Schema.Class<RosterMemberQuery>('RosterMemberQuery')({
  team_id: Schema.String,
  member_id: Schema.String,
}) {}

export class RosterEntry extends Schema.Class<RosterEntry>('RosterEntry')({
  member_id: TeamMemberNS.TeamMemberId,
  user_id: UserNS.UserId,
  role: TeamMemberNS.TeamRole,
  name: Schema.NullOr(Schema.String),
  birth_year: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(UserNS.Gender),
  jersey_number: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(UserNS.Position),
  proficiency: Schema.NullOr(UserNS.Proficiency),
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
          Request: TeamMemberNS.TeamMember.insert,
          Result: TeamMemberNS.TeamMember,
          execute: (input) => sql`
            INSERT INTO team_members (team_id, user_id, role, active)
            VALUES (${input.team_id}, ${input.user_id}, ${input.role}, ${input.active})
            RETURNING *
          `,
        }),
      ),
      Effect.let('findMembership', ({ sql }) =>
        SqlSchema.findOne({
          Request: MembershipQuery,
          Result: TeamMemberNS.TeamMember,
          execute: (input) =>
            sql`SELECT * FROM team_members WHERE team_id = ${input.team_id} AND user_id = ${input.user_id}`,
        }),
      ),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMemberNS.TeamMember,
          execute: (teamId) =>
            sql`SELECT * FROM team_members WHERE team_id = ${teamId} AND active = true`,
        }),
      ),
      Effect.let('findByUser', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMemberNS.TeamMember,
          execute: (userId) => sql`SELECT * FROM team_members WHERE user_id = ${userId}`,
        }),
      ),
      Effect.let('findRosterByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: RosterEntry,
          execute: (teamId) => sql`
            SELECT tm.id as member_id, tm.user_id, tm.role,
                   u.name, u.birth_year, u.gender, u.jersey_number, u.position,
                   u.proficiency, u.discord_username, u.discord_avatar
            FROM team_members tm JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${teamId} AND tm.active = true
          `,
        }),
      ),
      Effect.let('findRosterMember', ({ sql }) =>
        SqlSchema.findOne({
          Request: RosterMemberQuery,
          Result: RosterEntry,
          execute: (input) => sql`
            SELECT tm.id as member_id, tm.user_id, tm.role,
                   u.name, u.birth_year, u.gender, u.jersey_number, u.position,
                   u.proficiency, u.discord_username, u.discord_avatar
            FROM team_members tm JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${input.team_id} AND tm.id = ${input.member_id} AND tm.active = true
          `,
        }),
      ),
      Effect.let('deactivateMember', ({ sql }) =>
        SqlSchema.single({
          Request: RosterMemberQuery,
          Result: TeamMemberNS.TeamMember,
          execute: (input) => sql`
            UPDATE team_members SET active = false
            WHERE id = ${input.member_id} AND team_id = ${input.team_id}
            RETURNING *
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findMembershipByIds(teamId: TeamNS.TeamId, userId: UserNS.UserId) {
    return this.findMembership({ team_id: teamId, user_id: userId });
  }

  findRosterMemberByIds(teamId: TeamNS.TeamId, memberId: TeamMemberNS.TeamMemberId) {
    return this.findRosterMember({ team_id: teamId, member_id: memberId });
  }

  deactivateMemberByIds(teamId: TeamNS.TeamId, memberId: TeamMemberNS.TeamMemberId) {
    return this.deactivateMember({ team_id: teamId, member_id: memberId });
  }
}
