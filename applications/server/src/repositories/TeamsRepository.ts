import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { type Discord, Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

export class TeamsRepository extends Effect.Service<TeamsRepository>()('api/TeamsRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.bind('repo', () =>
      Model.makeRepository(Team.Team, {
        tableName: 'teams',
        spanPrefix: 'TeamsRepository',
        idColumn: 'id',
      }),
    ),
    Effect.let(
      'findById',
      ({ repo }) =>
        (id: Team.TeamId) =>
          repo.findById(id),
    ),
    Effect.let('insert', ({ repo }) => repo.insert),
    Effect.let('findByGuild', ({ sql }) =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: Team.Team,
        execute: (guildId) => sql`SELECT * FROM teams WHERE guild_id = ${guildId}`,
      }),
    ),
    Bind.remove('sql'),
    Bind.remove('repo'),
  ),
}) {
  findByGuildId(guildId: Discord.Snowflake) {
    return this.findByGuild(guildId);
  }
}
