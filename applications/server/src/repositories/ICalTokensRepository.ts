import { SqlClient, SqlSchema } from '@effect/sql';
import { ICalToken } from '@sideline/domain';
import { Effect, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

export class ICalTokensRepository extends Effect.Service<ICalTokensRepository>()(
  'api/ICalTokensRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _findByToken = SqlSchema.findOne({
    Request: Schema.String,
    Result: ICalToken.ICalToken,
    execute: (token) => this.sql`SELECT * FROM ical_tokens WHERE token = ${token}`,
  });

  private _findByUserId = SqlSchema.findOne({
    Request: Schema.String,
    Result: ICalToken.ICalToken,
    execute: (userId) => this.sql`SELECT * FROM ical_tokens WHERE user_id = ${userId}`,
  });

  private _create = SqlSchema.single({
    Request: Schema.Struct({ user_id: Schema.String, token: Schema.String }),
    Result: ICalToken.ICalToken,
    execute: (input) => this.sql`
      INSERT INTO ical_tokens (user_id, token)
      VALUES (${input.user_id}, ${input.token})
      RETURNING *
    `,
  });

  private _deleteByUserId = SqlSchema.void({
    Request: Schema.String,
    execute: (userId) => this.sql`DELETE FROM ical_tokens WHERE user_id = ${userId}`,
  });

  findByToken = (token: string) => this._findByToken(token).pipe(catchSqlErrors);

  findByUserId = (userId: string) => this._findByUserId(userId).pipe(catchSqlErrors);

  create = (userId: string) =>
    this._create({ user_id: userId, token: crypto.randomUUID() }).pipe(catchSqlErrors);

  regenerate = (userId: string) =>
    this._deleteByUserId(userId).pipe(
      Effect.flatMap(() => this._create({ user_id: userId, token: crypto.randomUUID() })),
      catchSqlErrors,
    );
}
