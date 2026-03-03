import { Model, SqlClient } from '@effect/sql';
import { Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect } from 'effect';

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
    Bind.remove('sql'),
    Bind.remove('repo'),
  ),
}) {}
