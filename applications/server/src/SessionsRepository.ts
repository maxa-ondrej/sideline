import { SqlClient } from '@effect/sql';
import type { UserId } from '@sideline/domain/AuthApi';
import { DateTime, Effect } from 'effect';

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly token: string;
  readonly expires_at: Date;
  readonly created_at: Date;
}

export class SessionsRepository extends Effect.Service<SessionsRepository>()(
  'api/SessionsRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      function create(userId: UserId, token: string, expiresAt: Date) {
        return sql<SessionRow>`
          INSERT INTO sessions (user_id, token, expires_at)
          VALUES (${userId}, ${token}, ${expiresAt})
          RETURNING *
        `.pipe(
          Effect.orDie,
          Effect.map((rows) => rows[0]),
        );
      }

      function findByToken(token: string) {
        return sql<SessionRow>`
          SELECT * FROM sessions WHERE token = ${token} AND expires_at > now()
        `.pipe(
          Effect.orDie,
          Effect.map((rows) => {
            if (rows.length === 0) return null;
            const row = rows[0];
            return {
              id: row.id,
              userId: row.user_id as UserId,
              token: row.token,
              expiresAt: DateTime.unsafeFromDate(row.expires_at),
              createdAt: DateTime.unsafeFromDate(row.created_at),
            };
          }),
        );
      }

      function deleteByToken(token: string) {
        return sql`DELETE FROM sessions WHERE token = ${token}`.pipe(Effect.orDie, Effect.asVoid);
      }

      return { create, findByToken, deleteByToken } as const;
    }),
  },
) {}
