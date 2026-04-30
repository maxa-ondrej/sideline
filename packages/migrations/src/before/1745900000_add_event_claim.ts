import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () =>
        sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES team_members(id) ON DELETE SET NULL`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS claim_discord_channel_id TEXT`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS claim_discord_message_id TEXT`,
    ),
    Effect.tap(
      () => sql`
        CREATE INDEX IF NOT EXISTS idx_events_claimed_by_unclaimed
          ON events (team_id)
          WHERE event_type = 'training' AND status = 'active' AND claimed_by IS NULL
      `,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_sync_events DROP CONSTRAINT IF EXISTS event_sync_events_event_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_sync_events ADD CONSTRAINT event_sync_events_event_type_check CHECK (event_type IN ('event_created', 'event_updated', 'event_cancelled', 'rsvp_reminder', 'event_started', 'training_claim_request', 'training_claim_update', 'unclaimed_training_reminder'))`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS claimed_by_member_id UUID`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS claimed_by_display_name TEXT`,
    ),
  ),
);
