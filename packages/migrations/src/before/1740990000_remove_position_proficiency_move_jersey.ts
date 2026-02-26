import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE team_members ADD COLUMN jersey_number INTEGER`),
    Effect.tap(
      () => sql`
      UPDATE team_members tm
      SET jersey_number = u.jersey_number
      FROM users u
      WHERE tm.user_id = u.id AND u.jersey_number IS NOT NULL
    `,
    ),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN jersey_number`),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN position`),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN proficiency`),
  ),
);
