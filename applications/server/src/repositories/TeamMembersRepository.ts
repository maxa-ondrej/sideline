import { SqlClient, SqlSchema } from '@effect/sql';
import type { TeamId } from '@sideline/domain/models/Team';
import { TeamMember } from '@sideline/domain/models/TeamMember';
import type { UserId } from '@sideline/domain/models/User';
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
          Request: TeamMember.insert,
          Result: TeamMember,
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
          Result: TeamMember,
          execute: (input) =>
            sql`SELECT * FROM team_members WHERE team_id = ${input.team_id} AND user_id = ${input.user_id}`,
        }),
      ),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMember,
          execute: (teamId) => sql`SELECT * FROM team_members WHERE team_id = ${teamId}`,
        }),
      ),
      Effect.let('findByUser', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamMember,
          execute: (userId) => sql`SELECT * FROM team_members WHERE user_id = ${userId}`,
        }),
      ),
    ),
  },
) {
  findMembershipByIds(teamId: TeamId, userId: UserId) {
    return this.findMembership({ team_id: teamId, user_id: userId });
  }
}
