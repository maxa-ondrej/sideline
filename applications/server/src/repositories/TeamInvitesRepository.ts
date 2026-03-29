import { SqlClient, SqlSchema } from '@effect/sql';
import { TeamInvite } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

export class TeamInvitesRepository extends Effect.Service<TeamInvitesRepository>()(
  'api/TeamInvitesRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _findByCode = SqlSchema.findOne({
    Request: Schema.String,
    Result: TeamInvite.TeamInvite,
    execute: (code) =>
      this
        .sql`SELECT * FROM team_invites WHERE code = ${code} AND active = true AND (expires_at IS NULL OR expires_at > now())`,
  });

  private _findByTeam = SqlSchema.findAll({
    Request: Schema.String,
    Result: TeamInvite.TeamInvite,
    execute: (teamId) => this.sql`SELECT * FROM team_invites WHERE team_id = ${teamId}`,
  });

  private _create = SqlSchema.single({
    Request: TeamInvite.TeamInvite.insert,
    Result: TeamInvite.TeamInvite,
    execute: (input) => this.sql`
      INSERT INTO team_invites (team_id, code, active, created_by, expires_at)
      VALUES (${input.team_id}, ${input.code}, ${input.active}, ${input.created_by}, ${input.expires_at})
      RETURNING *
    `,
  });

  private _deactivateByTeam = SqlSchema.void({
    Request: Schema.String,
    execute: (teamId) =>
      this.sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true`,
  });

  private _deactivateByTeamExcept = SqlSchema.void({
    Request: Schema.Struct({ teamId: Schema.String, excludeId: Schema.String }),
    execute: ({ teamId, excludeId }) =>
      this
        .sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true AND id != ${excludeId}`,
  });

  findByCode = (code: string) =>
    this._findByCode(code).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  findByTeam = (teamId: string) =>
    this._findByTeam(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  create = (input: typeof TeamInvite.TeamInvite.insert.Type) =>
    this._create(input).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  deactivateByTeam = (teamId: string) =>
    this._deactivateByTeam(teamId).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  deactivateByTeamExcept = (input: { teamId: string; excludeId: string }) =>
    this._deactivateByTeamExcept(input).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );
}
