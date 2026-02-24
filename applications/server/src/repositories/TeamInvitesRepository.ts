import { SqlClient, SqlSchema } from '@effect/sql';
import { TeamInvite as TeamInviteNS } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

export class TeamInvitesRepository extends Effect.Service<TeamInvitesRepository>()(
  'api/TeamInvitesRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByCode', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: TeamInviteNS.TeamInvite,
          execute: (code) =>
            sql`SELECT * FROM team_invites WHERE code = ${code} AND active = true AND (expires_at IS NULL OR expires_at > now())`,
        }),
      ),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TeamInviteNS.TeamInvite,
          execute: (teamId) => sql`SELECT * FROM team_invites WHERE team_id = ${teamId}`,
        }),
      ),
      Effect.let('create', ({ sql }) =>
        SqlSchema.single({
          Request: TeamInviteNS.TeamInvite.insert,
          Result: TeamInviteNS.TeamInvite,
          execute: (input) => sql`
            INSERT INTO team_invites (team_id, code, active, created_by, expires_at)
            VALUES (${input.team_id}, ${input.code}, ${input.active}, ${input.created_by}, ${input.expires_at})
            RETURNING *
          `,
        }),
      ),
      Effect.let('deactivateByTeam', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.String,
          execute: (teamId) =>
            sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true`,
        }),
      ),
      Effect.let('deactivateByTeamExcept', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.Struct({ teamId: Schema.String, excludeId: Schema.String }),
          execute: ({ teamId, excludeId }) =>
            sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true AND id != ${excludeId}`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {}
