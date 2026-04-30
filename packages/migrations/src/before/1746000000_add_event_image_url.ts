import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT`),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS event_image_url TEXT`,
    ),
  ),
);
