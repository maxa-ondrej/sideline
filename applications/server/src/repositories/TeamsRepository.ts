import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { type Discord, Team } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, type Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class TeamUpdateInput extends Schema.Class<TeamUpdateInput>('TeamUpdateInput')({
  id: Schema.String,
  name: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  sport: Schema.OptionFromNullOr(Schema.String),
  logo_url: Schema.OptionFromNullOr(Schema.String),
}) {}

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
    this.findByGuildQuery(guildId).pipe(catchSqlErrors);

  findByGuildIds = (
    guildIds: ReadonlyArray<typeof Discord.Snowflake.Type>,
  ): Effect.Effect<ReadonlyArray<Team.Team>> => {
    if (Array.isEmptyReadonlyArray(guildIds)) {
      return Effect.succeed([]);
    }
    return this.sql`SELECT * FROM teams WHERE guild_id IN ${this.sql.in(guildIds)}`.pipe(
      Effect.flatMap(Schema.decodeUnknown(Schema.Array(Team.Team))),
      catchSqlErrors,
    );
  };

  private updateTeamQuery = SqlSchema.single({
    Request: TeamUpdateInput,
    Result: Team.Team,
    execute: (input) => this.sql`
      UPDATE teams SET
        name = ${input.name},
        description = ${input.description},
        sport = ${input.sport},
        logo_url = ${input.logo_url},
        updated_at = now()
      WHERE id = ${input.id}
      RETURNING *
    `,
  });

  update = (input: {
    readonly id: Team.TeamId;
    readonly name: string;
    readonly description: Option.Option<string>;
    readonly sport: Option.Option<string>;
    readonly logo_url: Option.Option<string>;
  }) =>
    this.updateTeamQuery(input).pipe(
      catchSqlErrors,
      Effect.catchTag(
        'NoSuchElementException',
        LogicError.withMessage(() => 'Team update returned no row'),
      ),
    );
}
