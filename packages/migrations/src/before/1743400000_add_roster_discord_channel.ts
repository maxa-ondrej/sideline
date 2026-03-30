import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`ALTER TABLE rosters ADD COLUMN discord_channel_id TEXT`,
);
