import { ICalToken } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const _findByToken = SqlSchema.findOne({
    Request: Schema.String,
    Result: ICalToken.ICalToken,
    execute: (token) => sql`SELECT * FROM ical_tokens WHERE token = ${token}`,
  });

  const _findByUserId = SqlSchema.findOne({
    Request: Schema.String,
    Result: ICalToken.ICalToken,
    execute: (userId) => sql`SELECT * FROM ical_tokens WHERE user_id = ${userId}`,
  });

  const _create = SqlSchema.findOne({
    Request: Schema.Struct({ user_id: Schema.String, token: Schema.String }),
    Result: ICalToken.ICalToken,
    execute: (input) => sql`
      INSERT INTO ical_tokens (user_id, token)
      VALUES (${input.user_id}, ${input.token})
      RETURNING *
    `,
  });

  const _deleteByUserId = SqlSchema.void({
    Request: Schema.String,
    execute: (userId) => sql`DELETE FROM ical_tokens WHERE user_id = ${userId}`,
  });

  const findByToken = (token: string) => _findByToken(token).pipe(catchSqlErrors);

  const findByUserId = (userId: string) => _findByUserId(userId).pipe(catchSqlErrors);

  const create = (userId: string) =>
    _create({ user_id: userId, token: crypto.randomUUID() }).pipe(catchSqlErrors);

  const regenerate = (userId: string) =>
    _deleteByUserId(userId).pipe(
      Effect.flatMap(() => _create({ user_id: userId, token: crypto.randomUUID() })),
      catchSqlErrors,
    );

  return {
    findByToken,
    findByUserId,
    create,
    regenerate,
  };
});

export class ICalTokensRepository extends ServiceMap.Service<
  ICalTokensRepository,
  Effect.Success<typeof make>
>()('api/ICalTokensRepository') {
  static readonly Default = Layer.effect(ICalTokensRepository, make);
}
