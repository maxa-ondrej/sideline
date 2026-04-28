import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS rsvp_reminder_days_before INT NOT NULL DEFAULT 1`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS rsvp_reminder_time TIME NOT NULL DEFAULT '18:00'`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS reminders_channel_id TEXT`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Prague'`,
    ),
    Effect.tap(
      () => sql`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'team_settings' AND column_name = 'rsvp_reminder_hours'
          ) THEN
            UPDATE team_settings SET
              rsvp_reminder_days_before = CASE
                WHEN rsvp_reminder_hours = 0 THEN 0
                ELSE GREATEST(1, CEIL(rsvp_reminder_hours::numeric / 24))::INT
              END,
              rsvp_reminder_time = '18:00'::time;
          END IF;
        END $$
      `,
    ),
    Effect.tap(() => sql`ALTER TABLE team_settings DROP COLUMN IF EXISTS rsvp_reminder_hours`),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS member_group_id UUID`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS discord_role_id TEXT`,
    ),
  ),
);
