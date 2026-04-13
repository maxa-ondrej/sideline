import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE event_sync_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('event_created', 'event_updated', 'event_cancelled')),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        event_title TEXT NOT NULL,
        event_description TEXT,
        event_start_at TEXT NOT NULL,
        event_end_at TEXT,
        event_location TEXT,
        event_event_type TEXT NOT NULL,
        processed_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(
      () =>
        sql`CREATE INDEX idx_event_sync_unprocessed ON event_sync_events(created_at) WHERE processed_at IS NULL`,
    ),
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN discord_channel_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN discord_message_id TEXT`),
  ),
);
