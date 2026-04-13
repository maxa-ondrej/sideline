import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE rosters ADD COLUMN discord_channel_id TEXT`,
);
