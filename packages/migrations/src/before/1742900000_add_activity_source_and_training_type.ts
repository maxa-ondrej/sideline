import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`ALTER TABLE activity_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_source_check CHECK (source IN ('manual', 'auto'))`,
    ),
    Effect.tap(
      () => sql`ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_activity_type_check`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_activity_type_check CHECK (activity_type IN ('gym', 'running', 'stretching', 'training'))`,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_activity_logs_auto_training_dedup ON activity_logs (team_member_id, (logged_at::date)) WHERE source = 'auto' AND activity_type = 'training'`,
    ),
  ),
);
