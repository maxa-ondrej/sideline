import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.all([
    sql`ALTER TABLE subgroups ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
    sql`ALTER TABLE roles ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false`,
    sql`
      ALTER TABLE discord_channel_mappings
        ADD CONSTRAINT discord_channel_mappings_subgroup_id_fkey
        FOREIGN KEY (subgroup_id) REFERENCES subgroups(id) ON DELETE CASCADE
    `,
    sql`
      ALTER TABLE discord_role_mappings
        ADD CONSTRAINT discord_role_mappings_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    `,
  ]),
);
