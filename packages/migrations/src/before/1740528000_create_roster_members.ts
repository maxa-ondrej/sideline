import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    CREATE TABLE roster_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      roster_id UUID NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
      team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (roster_id, team_member_id)
    );
    CREATE INDEX idx_roster_members_roster ON roster_members(roster_id);
  `,
);
