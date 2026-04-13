import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.all([
    sql`ALTER TABLE subgroups ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
    sql`ALTER TABLE roles ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
  ]),
);
