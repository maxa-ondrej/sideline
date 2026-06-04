import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE IF NOT EXISTS team_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT,
        position INT NOT NULL DEFAULT 0,
        archived BOOLEAN NOT NULL DEFAULT false,
        discord_channel_id TEXT,
        discord_role_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_team_channels_team_name_active
        ON team_channels(team_id, name) WHERE archived = false
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE INDEX IF NOT EXISTS idx_team_channels_team_position
        ON team_channels(team_id, position)
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE IF NOT EXISTS team_channel_access (
        team_channel_id UUID NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        access_level TEXT NOT NULL CHECK (access_level IN ('VIEW', 'EDIT', 'ADMIN')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (team_channel_id, group_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE INDEX IF NOT EXISTS idx_team_channel_access_group
        ON team_channel_access(group_id)
    `,
    ),
  ),
);
