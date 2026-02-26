import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
        ALTER TABLE discord_channel_mappings
          DROP CONSTRAINT discord_channel_mappings_subgroup_id_fkey
      `,
    ),
    Effect.tap(
      () => sql`
        ALTER TABLE discord_channel_mappings
          ADD CONSTRAINT discord_channel_mappings_subgroup_id_fkey
            FOREIGN KEY (subgroup_id) REFERENCES subgroups(id)
      `,
    ),
  ),
);
