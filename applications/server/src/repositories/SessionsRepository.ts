import { Session } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const _create = SqlSchema.findOne({
    Request: Session.Session.insert,
    Result: Session.Session,
    execute: (input) => sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${input.user_id}, ${input.token}, ${input.expires_at})
      RETURNING *
    `,
  });

  const _findByToken = SqlSchema.findOne({
    Request: Schema.String,
    Result: Session.Session,
    execute: (token) => sql`SELECT * FROM sessions WHERE token = ${token} AND expires_at > now()`,
  });

  const _deleteByToken = SqlSchema.void({
    Request: Schema.String,
    execute: (token) => sql`DELETE FROM sessions WHERE token = ${token}`,
  });

  const create = (input: typeof Session.Session.insert.Type) => _create(input).pipe(catchSqlErrors);

  const findByToken = (token: string) => _findByToken(token).pipe(catchSqlErrors);

  const deleteByToken = (token: string) => _deleteByToken(token).pipe(catchSqlErrors);

  return {
    create,
    findByToken,
    deleteByToken,
  };
});

export class SessionsRepository extends ServiceMap.Service<
  SessionsRepository,
  Effect.Success<typeof make>
>()('api/SessionsRepository') {
  static readonly Default = Layer.effect(SessionsRepository, make);
}
