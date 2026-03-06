import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN min_players_threshold INTEGER NOT NULL DEFAULT 0`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN rsvp_reminder_hours INTEGER NOT NULL DEFAULT 24`,
    ),
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN reminder_sent_at TIMESTAMPTZ`),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events DROP CONSTRAINT event_sync_events_event_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_sync_events ADD CONSTRAINT event_sync_events_event_type_check CHECK (event_type IN ('event_created', 'event_updated', 'event_cancelled', 'rsvp_reminder'))`,
    ),
  ),
);
