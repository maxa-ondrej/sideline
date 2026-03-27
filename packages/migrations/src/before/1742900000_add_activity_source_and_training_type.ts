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
      () => sql`
        CREATE TABLE activity_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_activity_types_global_slug ON activity_types(slug) WHERE team_id IS NULL`,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_activity_types_team_name ON activity_types(team_id, name) WHERE team_id IS NOT NULL`,
    ),
    Effect.tap(
      () => sql`
        INSERT INTO activity_types (team_id, name, slug) VALUES
          (NULL, 'Gym', 'gym'),
          (NULL, 'Run', 'running'),
          (NULL, 'Stretch', 'stretching'),
          (NULL, 'Training', 'training')
      `,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE activity_logs ADD COLUMN activity_type_id UUID REFERENCES activity_types(id)`,
    ),
    Effect.tap(
      () =>
        sql`UPDATE activity_logs SET activity_type_id = (SELECT id FROM activity_types WHERE slug = activity_logs.activity_type AND team_id IS NULL)`,
    ),
    Effect.tap(() => sql`ALTER TABLE activity_logs ALTER COLUMN activity_type_id SET NOT NULL`),
    Effect.tap(
      () => sql`ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_activity_type_check`,
    ),
    Effect.tap(() => sql`ALTER TABLE activity_logs DROP COLUMN activity_type`),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX idx_activity_logs_auto_training_dedup ON activity_logs (team_member_id, ((logged_at AT TIME ZONE 'UTC')::date)) WHERE source = 'auto'`,
    ),
  ),
);
