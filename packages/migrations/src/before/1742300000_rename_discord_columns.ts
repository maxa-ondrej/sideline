import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE users RENAME COLUMN discord_username TO username`),
    Effect.tap(() => sql`ALTER TABLE users RENAME COLUMN discord_avatar TO avatar`),
  ),
);
