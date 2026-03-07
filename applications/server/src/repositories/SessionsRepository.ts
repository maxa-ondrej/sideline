import { SqlClient, SqlSchema } from '@effect/sql';
import { Session } from '@sideline/domain';
import { Effect, Schema } from 'effect';

export class SessionsRepository extends Effect.Service<SessionsRepository>()(
  'api/SessionsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _create = SqlSchema.single({
    Request: Session.Session.insert,
    Result: Session.Session,
    execute: (input) => this.sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${input.user_id}, ${input.token}, ${input.expires_at})
      RETURNING *
    `,
  });

  private _findByToken = SqlSchema.findOne({
    Request: Schema.String,
    Result: Session.Session,
    execute: (token) =>
      this.sql`SELECT * FROM sessions WHERE token = ${token} AND expires_at > now()`,
  });

  private _deleteByToken = SqlSchema.void({
    Request: Schema.String,
    execute: (token) => this.sql`DELETE FROM sessions WHERE token = ${token}`,
  });

  create = (input: typeof Session.Session.insert.Type) => this._create(input).pipe(Effect.orDie);

  findByToken = (token: string) => this._findByToken(token).pipe(Effect.orDie);

  deleteByToken = (token: string) => this._deleteByToken(token).pipe(Effect.orDie);
}
