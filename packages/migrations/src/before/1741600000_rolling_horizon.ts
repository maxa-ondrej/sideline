import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE team_settings (
        team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
        event_horizon_days INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(() => sql`ALTER TABLE event_series ALTER COLUMN end_date DROP NOT NULL`),
    Effect.tap(() => sql`ALTER TABLE event_series ADD COLUMN last_generated_date DATE`),
    Effect.tap(
      () => sql`UPDATE event_series SET last_generated_date = end_date WHERE status = 'active'`,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_events_series_date ON events (series_id, event_date) WHERE series_id IS NOT NULL`,
    ),
  ),
);
