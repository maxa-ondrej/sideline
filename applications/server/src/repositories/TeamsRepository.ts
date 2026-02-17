import { Model, SqlClient } from '@effect/sql';
import { Team, type TeamId } from '@sideline/domain/models/Team';
import { Bind } from '@sideline/effect-lib';
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
      ({ repo }) =>
        (id: TeamId) =>
          repo.findById(id),
    ),
    Effect.let('insert', ({ repo }) => repo.insert),
    Bind.remove('sql'),
    Bind.remove('repo'),
  ),
}) {}
