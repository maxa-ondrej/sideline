import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE events ADD COLUMN auto_logged_at TIMESTAMPTZ`,
);
