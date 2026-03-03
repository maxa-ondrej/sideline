import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE event_series (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        training_type_id UUID REFERENCES training_types(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TIME NOT NULL,
        end_time TIME,
        location TEXT,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly')),
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
        created_by UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_event_series_team ON event_series(team_id)`),
    Effect.tap(
      () =>
        sql`ALTER TABLE events ADD COLUMN series_id UUID REFERENCES event_series(id) ON DELETE SET NULL`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE events ADD COLUMN series_modified BOOLEAN NOT NULL DEFAULT false`,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_events_series ON events(series_id)`),
  ),
);
