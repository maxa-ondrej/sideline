import { TeamInvite } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const _findByCode = SqlSchema.findOneOption({
    Request: Schema.String,
    Result: TeamInvite.TeamInvite,
    execute: (code) =>
      sql`SELECT * FROM team_invites WHERE code = ${code} AND active = true AND (expires_at IS NULL OR expires_at > now())`,
  });

  const _findByTeam = SqlSchema.findAll({
    Request: Schema.String,
    Result: TeamInvite.TeamInvite,
    execute: (teamId) => sql`SELECT * FROM team_invites WHERE team_id = ${teamId}`,
  });

  const _create = SqlSchema.findOne({
    Request: TeamInvite.TeamInvite.insert,
    Result: TeamInvite.TeamInvite,
    execute: (input) => sql`
      INSERT INTO team_invites (team_id, code, active, created_by, expires_at)
      VALUES (${input.team_id}, ${input.code}, ${input.active}, ${input.created_by}, ${input.expires_at})
      RETURNING *
    `,
  });

  const _deactivateByTeam = SqlSchema.void({
    Request: Schema.String,
    execute: (teamId) =>
      sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true`,
  });

  const _deactivateByTeamExcept = SqlSchema.void({
    Request: Schema.Struct({ teamId: Schema.String, excludeId: Schema.String }),
    execute: ({ teamId, excludeId }) =>
      sql`UPDATE team_invites SET active = false WHERE team_id = ${teamId} AND active = true AND id != ${excludeId}`,
  });

  const findByCode = (code: string) => _findByCode(code).pipe(catchSqlErrors);

  const findByTeam = (teamId: string) => _findByTeam(teamId).pipe(catchSqlErrors);

  const create = (input: typeof TeamInvite.TeamInvite.insert.Type) =>
    _create(input).pipe(catchSqlErrors);

  const deactivateByTeam = (teamId: string) => _deactivateByTeam(teamId).pipe(catchSqlErrors);

  const deactivateByTeamExcept = (input: { teamId: string; excludeId: string }) =>
    _deactivateByTeamExcept(input).pipe(catchSqlErrors);

  return {
    findByCode,
    findByTeam,
    create,
    deactivateByTeam,
    deactivateByTeamExcept,
  };
});

export class TeamInvitesRepository extends ServiceMap.Service<
  TeamInvitesRepository,
  Effect.Success<typeof make>
>()('api/TeamInvitesRepository') {
  static readonly Default = Layer.effect(TeamInvitesRepository, make);
}
