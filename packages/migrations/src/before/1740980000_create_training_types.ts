import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE training_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_training_types_team ON training_types(team_id)`),
    Effect.tap(
      () => sql`CREATE UNIQUE INDEX idx_training_types_team_name ON training_types(team_id, name)`,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE training_type_coaches (
        training_type_id UUID NOT NULL REFERENCES training_types(id) ON DELETE CASCADE,
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        PRIMARY KEY (training_type_id, team_member_id)
      )
    `,
    ),
    Effect.tap(
      () =>
        sql`CREATE INDEX idx_training_type_coaches_member ON training_type_coaches(team_member_id)`,
    ),
  ),
);
