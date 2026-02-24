import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE team_members ADD COLUMN active BOOLEAN NOT NULL DEFAULT true`,
);
