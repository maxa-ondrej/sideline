import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  Effect.service(SqlClient.SqlClient),
  (sql) => sql`ALTER TABLE discord_channel_mappings ADD COLUMN discord_role_id TEXT`,
);
