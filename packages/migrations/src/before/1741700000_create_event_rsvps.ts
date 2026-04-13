import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE event_rsvps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (event_id, team_member_id)
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id)`),
  ),
);
