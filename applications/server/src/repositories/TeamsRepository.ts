import { Model, SqlClient } from '@effect/sql';
import { Team, type TeamId } from '@sideline/domain/models/Team';
import { Effect } from 'effect';

export class TeamsRepository extends Effect.Service<TeamsRepository>()('api/TeamsRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.bind('repo', () =>
      Model.makeRepository(Team, {
        tableName: 'teams',
        spanPrefix: 'TeamsRepository',
        idColumn: 'id',
      }),
    ),
    Effect.let(
      'findById',
      ({ repo }) => repo.findById as (id: TeamId) => ReturnType<typeof repo.findById>,
    ),
    Effect.let('insert', ({ repo }) => repo.insert),
  ),
}) {}
