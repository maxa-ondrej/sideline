import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    ALTER TABLE discord_channel_mappings
      DROP CONSTRAINT discord_channel_mappings_subgroup_id_fkey
  `,
);
