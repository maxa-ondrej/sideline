import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS discord_channel_late_rsvp TEXT`,
    ),
  ),
);
