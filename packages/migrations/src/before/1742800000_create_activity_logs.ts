import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL CHECK (activity_type IN ('gym', 'running', 'stretching')),
        logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        duration_minutes INTEGER CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(
      () => sql`CREATE INDEX idx_activity_logs_team_member_id ON activity_logs(team_member_id)`,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_activity_logs_logged_at ON activity_logs(logged_at)`),
  ),
);
