import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        training_type_id UUID REFERENCES training_types(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('training','match','tournament','meeting','social','other')),
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
        created_by UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_events_team ON events(team_id)`),
    Effect.tap(() => sql`CREATE INDEX idx_events_team_date ON events(team_id, event_date)`),
    Effect.tap(() => sql`CREATE INDEX idx_events_training_type ON events(training_type_id)`),
    Effect.tap(
      () => sql`
      INSERT INTO role_permissions (role_id, permission)
      SELECT r.id, p.perm FROM roles r
      CROSS JOIN (VALUES ('event:create'), ('event:edit'), ('event:cancel')) AS p(perm)
      WHERE r.is_built_in = true AND r.name IN ('Admin', 'Captain')
      ON CONFLICT DO NOTHING
    `,
    ),
  ),
);
