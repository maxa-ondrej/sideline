import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE events ADD COLUMN auto_logged_at TIMESTAMPTZ`,
);
