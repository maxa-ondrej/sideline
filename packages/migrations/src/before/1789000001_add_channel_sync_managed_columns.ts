import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      ALTER TABLE channel_sync_events
        ADD COLUMN IF NOT EXISTS team_channel_id UUID,
        ADD COLUMN IF NOT EXISTS access_level TEXT
    `,
    ),
  ),
);
