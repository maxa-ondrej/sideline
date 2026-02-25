import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE age_threshold_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        min_age INT,
        max_age INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (team_id, role_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`CREATE INDEX idx_age_threshold_rules_team ON age_threshold_rules(team_id)`,
    ),
  ),
);
