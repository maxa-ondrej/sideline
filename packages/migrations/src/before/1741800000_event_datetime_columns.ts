import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN start_at TIMESTAMPTZ`),
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN end_at TIMESTAMPTZ`),
    Effect.tap(
      () => sql`
      UPDATE events SET
        start_at = (event_date + start_time),
        end_at = CASE WHEN end_time IS NOT NULL THEN (event_date + end_time) ELSE NULL END
    `,
    ),
    Effect.tap(() => sql`ALTER TABLE events ALTER COLUMN start_at SET NOT NULL`),
    Effect.tap(() => sql`ALTER TABLE events DROP COLUMN event_date`),
    Effect.tap(() => sql`ALTER TABLE events DROP COLUMN start_time`),
    Effect.tap(() => sql`ALTER TABLE events DROP COLUMN end_time`),
    Effect.tap(() => sql`DROP INDEX IF EXISTS idx_events_team_date`),
    Effect.tap(() => sql`CREATE INDEX idx_events_team_date ON events(team_id, start_at)`),
    Effect.tap(() => sql`DROP INDEX IF EXISTS idx_events_series_date`),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_events_series_date ON events(series_id, ((start_at AT TIME ZONE 'UTC')::date)) WHERE series_id IS NOT NULL`,
    ),
  ),
);
