import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE groups ADD COLUMN color TEXT`),
    Effect.tap(() => sql`ALTER TABLE rosters ADD COLUMN color TEXT`),
    Effect.tap(() => sql`ALTER TABLE rosters ADD COLUMN emoji TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN discord_role_color INTEGER`),
    Effect.tap(
      () =>
        sql`ALTER TABLE channel_sync_events DROP CONSTRAINT IF EXISTS channel_sync_events_event_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE channel_sync_events ADD CONSTRAINT channel_sync_events_event_type_check CHECK (event_type IN ('channel_created', 'channel_deleted', 'channel_archived', 'channel_detached', 'channel_updated', 'member_added', 'member_removed'))`,
    ),
  ),
);
