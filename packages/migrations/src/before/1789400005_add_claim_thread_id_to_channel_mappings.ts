import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
        ALTER TABLE discord_channel_mappings ADD COLUMN IF NOT EXISTS claim_thread_id TEXT
      `,
    ),
  ),
);
