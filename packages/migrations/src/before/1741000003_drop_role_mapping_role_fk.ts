import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    ALTER TABLE discord_role_mappings
      DROP CONSTRAINT discord_role_mappings_role_id_fkey
  `,
);
