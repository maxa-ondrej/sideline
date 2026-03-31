import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_archive_category_id TEXT`),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN discord_channel_cleanup_on_group_delete TEXT NOT NULL DEFAULT 'delete'`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN discord_channel_cleanup_on_roster_deactivate TEXT NOT NULL DEFAULT 'delete'`,
    ),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN archive_category_id TEXT`),
    Effect.tap(
      () =>
        sql`ALTER TABLE channel_sync_events DROP CONSTRAINT IF EXISTS channel_sync_events_event_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE channel_sync_events ADD CONSTRAINT channel_sync_events_event_type_check CHECK (event_type IN ('channel_created', 'channel_deleted', 'channel_archived', 'channel_detached', 'member_added', 'member_removed'))`,
    ),
  ),
);
