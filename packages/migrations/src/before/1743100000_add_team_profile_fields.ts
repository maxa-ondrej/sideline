import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN description TEXT`),
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN sport TEXT`),
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN logo_url TEXT`),
  ),
);
