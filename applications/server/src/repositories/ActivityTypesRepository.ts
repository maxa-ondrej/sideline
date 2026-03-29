import { SqlClient, SqlSchema } from '@effect/sql';
import { ActivityType, Team } from '@sideline/domain';
import { Effect, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class ActivityTypeRow extends Schema.Class<ActivityTypeRow>('ActivityTypeRow')({
  id: ActivityType.ActivityTypeId,
  team_id: Schema.OptionFromNullOr(Team.TeamId),
  name: Schema.String,
  slug: Schema.OptionFromNullOr(Schema.String),
}) {}

export class ActivityTypesRepository extends Effect.Service<ActivityTypesRepository>()(
  'api/ActivityTypesRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findBySlugQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: ActivityTypeRow,
    execute: (slug) =>
      this
        .sql`SELECT id, team_id, name, slug FROM activity_types WHERE slug = ${slug} AND team_id IS NULL`,
  });

  private findByTeamIdQuery = SqlSchema.findAll({
    Request: Team.TeamId,
    Result: ActivityTypeRow,
    execute: (teamId) =>
      this
        .sql`SELECT id, team_id, name, slug FROM activity_types WHERE team_id IS NULL OR team_id = ${teamId} ORDER BY team_id NULLS FIRST, name`,
  });

  private findByIdQuery = SqlSchema.findOne({
    Request: ActivityType.ActivityTypeId,
    Result: ActivityTypeRow,
    execute: (id) => this.sql`SELECT id, team_id, name, slug FROM activity_types WHERE id = ${id}`,
  });

  findBySlug = (slug: string) => this.findBySlugQuery(slug).pipe(catchSqlErrors);

  findByTeamId = (teamId: Team.TeamId) => this.findByTeamIdQuery(teamId).pipe(catchSqlErrors);

  findById = (id: ActivityType.ActivityTypeId) => this.findByIdQuery(id).pipe(catchSqlErrors);
}
