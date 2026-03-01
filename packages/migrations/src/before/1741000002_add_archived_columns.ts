import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.all([
    sql`ALTER TABLE subgroups ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
    sql`ALTER TABLE roles ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
  ]),
);
