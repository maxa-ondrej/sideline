import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { type Discord, Team } from '@sideline/domain';
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
  ),
}) {
  findById = (id: Team.TeamId) => this.repo.findById(id);

  insert = (input: typeof Team.Team.insert.Type) => this.repo.insert(input);

  private findByGuildQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: Team.Team,
    execute: (guildId) => this.sql`SELECT * FROM teams WHERE guild_id = ${guildId}`,
  });

  findByGuildId = (guildId: Discord.Snowflake) =>
    this.findByGuildQuery(guildId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
