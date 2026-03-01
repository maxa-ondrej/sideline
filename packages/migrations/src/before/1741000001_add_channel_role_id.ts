import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE discord_channel_mappings ADD COLUMN discord_role_id TEXT`,
);
