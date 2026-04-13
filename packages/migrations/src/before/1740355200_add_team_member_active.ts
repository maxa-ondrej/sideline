import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE team_members ADD COLUMN active BOOLEAN NOT NULL DEFAULT true`,
);
