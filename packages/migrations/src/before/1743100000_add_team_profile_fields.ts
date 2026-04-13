import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN description TEXT`),
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN sport TEXT`),
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN logo_url TEXT`),
  ),
);
