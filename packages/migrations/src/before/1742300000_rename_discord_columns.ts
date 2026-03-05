import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE users RENAME COLUMN discord_username TO username`),
    Effect.tap(() => sql`ALTER TABLE users RENAME COLUMN discord_avatar TO avatar`),
  ),
);
