import { SqlClient, SqlSchema } from '@effect/sql';
import { Session } from '@sideline/domain/models/Session';
import { Effect, Schema } from 'effect';

export class SessionsRepository extends Effect.Service<SessionsRepository>()(
  'api/SessionsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('create', ({ sql }) =>
        SqlSchema.single({
          Request: Session.insert,
          Result: Session,
          execute: (input) => sql`
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (${input.user_id}, ${input.token}, ${input.expires_at})
            RETURNING *
          `,
        }),
      ),
      Effect.let('findByToken', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: Session,
          execute: (token) =>
            sql`SELECT * FROM sessions WHERE token = ${token} AND expires_at > now()`,
        }),
      ),
      Effect.let('deleteByToken', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.String,
          execute: (token) => sql`DELETE FROM sessions WHERE token = ${token}`,
        }),
      ),
    ),
  },
) {}
