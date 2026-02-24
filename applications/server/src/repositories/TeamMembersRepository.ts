import { SqlClient, SqlSchema } from '@effect/sql';
import {
  TeamMember as TeamMemberNS,
  type Team as TeamNS,
  type User as UserNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MembershipQuery extends Schema.Class<MembershipQuery>('MembershipQuery')({
  team_id: Schema.String,
  user_id: Schema.String,
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
            INSERT INTO team_members (team_id, user_id, role)
            VALUES (${input.team_id}, ${input.user_id}, ${input.role})
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
          execute: (teamId) => sql`SELECT * FROM team_members WHERE team_id = ${teamId}`,
        }),
      ),
      Effect.let('findByUser', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMemberNS.TeamMember,
          execute: (userId) => sql`SELECT * FROM team_members WHERE user_id = ${userId}`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findMembershipByIds(teamId: TeamNS.TeamId, userId: UserNS.UserId) {
    return this.findMembership({ team_id: teamId, user_id: userId });
  }
}
