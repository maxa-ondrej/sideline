import { type Discord, Team } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, Layer, type Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class TeamUpdateInput extends Schema.Class<TeamUpdateInput>('TeamUpdateInput')({
  id: Schema.String,
  name: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  sport: Schema.OptionFromNullOr(Schema.String),
  logo_url: Schema.OptionFromNullOr(Schema.String),
}) {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findById = (id: Team.TeamId) => repo.findById(id);

  const insert = (input: typeof Team.Team.insert.Type) => repo.insert(input);

  const findByGuildQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: Team.Team,
    execute: (guildId) => sql`SELECT * FROM teams WHERE guild_id = ${guildId}`,
  });

  const findByGuildId = (guildId: Discord.Snowflake) =>
    findByGuildQuery(guildId).pipe(catchSqlErrors);

  const findByGuildIds = (
    guildIds: ReadonlyArray<typeof Discord.Snowflake.Type>,
  ): Effect.Effect<ReadonlyArray<Team.Team>> => {
    if (Array.isEmptyReadonlyArray(guildIds)) {
      return Effect.succeed([]);
    }
    return sql`SELECT * FROM teams WHERE guild_id IN ${sql.in(guildIds)}`.pipe(
      Effect.flatMap(Schema.decodeUnknown(Schema.Array(Team.Team))),
      catchSqlErrors,
    );
  };

  const updateTeamQuery = SqlSchema.findOne({
    Request: TeamUpdateInput,
    Result: Team.Team,
    execute: (input) => sql`
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

  const update = (input: {
    readonly id: Team.TeamId;
    readonly name: string;
    readonly description: Option.Option<string>;
    readonly sport: Option.Option<string>;
    readonly logo_url: Option.Option<string>;
  }) =>
    updateTeamQuery(input).pipe(
      catchSqlErrors,
      Effect.catchTag(
        'NoSuchElementException',
        LogicError.withMessage(() => 'Team update returned no row'),
      ),
    );

  return {
    findById,
    insert,
    findByGuildId,
    findByGuildIds,
    update,
  };
});

export class TeamsRepository extends ServiceMap.Service<
  TeamsRepository,
  Effect.Success<typeof make>
>()('api/TeamsRepository') {
  static readonly Default = Layer.effect(TeamsRepository, make);
}
