import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE events DROP CONSTRAINT events_status_check`),
    Effect.tap(
      () =>
        sql`ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('active', 'cancelled', 'started'))`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events DROP CONSTRAINT event_sync_events_event_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_sync_events ADD CONSTRAINT event_sync_events_event_type_check CHECK (event_type IN ('event_created', 'event_updated', 'event_cancelled', 'rsvp_reminder', 'event_started'))`,
    ),
  ),
);
