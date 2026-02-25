import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE subgroups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_subgroups_team ON subgroups(team_id)`),
    Effect.tap(() => sql`CREATE UNIQUE INDEX idx_subgroups_team_name ON subgroups(team_id, name)`),
    Effect.tap(
      () => sql`
      CREATE TABLE subgroup_members (
        subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        PRIMARY KEY (subgroup_id, team_member_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`CREATE INDEX idx_subgroup_members_member ON subgroup_members(team_member_id)`,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE subgroup_permissions (
        subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        PRIMARY KEY (subgroup_id, permission)
      )
    `,
    ),
  ),
);
