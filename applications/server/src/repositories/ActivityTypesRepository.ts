import { ActivityType, Team } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class ActivityTypeRow extends Schema.Class<ActivityTypeRow>('ActivityTypeRow')({
  id: ActivityType.ActivityTypeId,
  team_id: Schema.OptionFromNullOr(Team.TeamId),
  name: Schema.String,
  slug: Schema.OptionFromNullOr(Schema.String),
}) {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findBySlugQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: ActivityTypeRow,
    execute: (slug) =>
      this
        .sql`SELECT id, team_id, name, slug FROM activity_types WHERE slug = ${slug} AND team_id IS NULL`,
  });

  const findByTeamIdQuery = SqlSchema.findAll({
    Request: Team.TeamId,
    Result: ActivityTypeRow,
    execute: (teamId) =>
      this
        .sql`SELECT id, team_id, name, slug FROM activity_types WHERE team_id IS NULL OR team_id = ${teamId} ORDER BY team_id NULLS FIRST, name`,
  });

  const findByIdQuery = SqlSchema.findOne({
    Request: ActivityType.ActivityTypeId,
    Result: ActivityTypeRow,
    execute: (id) => sql`SELECT id, team_id, name, slug FROM activity_types WHERE id = ${id}`,
  });

  const findBySlug = (slug: string) => findBySlugQuery(slug).pipe(catchSqlErrors);

  const findByTeamId = (teamId: Team.TeamId) => findByTeamIdQuery(teamId).pipe(catchSqlErrors);

  const findById = (id: ActivityType.ActivityTypeId) => findByIdQuery(id).pipe(catchSqlErrors);

  return {
    findBySlug,
    findByTeamId,
    findById,
  };
});

export class ActivityTypesRepository extends ServiceMap.Service<
  ActivityTypesRepository,
  Effect.Success<typeof make>
>()('api/ActivityTypesRepository') {
  static readonly Default = Layer.effect(ActivityTypesRepository, make);
}
