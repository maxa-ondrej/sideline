import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE teams ADD COLUMN guild_id TEXT`),
    Effect.tap(() => sql`CREATE INDEX idx_teams_guild_id ON teams(guild_id)`),
    Effect.tap(
      () => sql`
      CREATE TABLE discord_role_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        discord_role_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(team_id, role_id),
        UNIQUE(team_id, discord_role_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE role_sync_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('role_assigned','role_unassigned','role_created','role_deleted')),
        role_id UUID NOT NULL,
        role_name TEXT,
        team_member_id UUID,
        discord_user_id TEXT,
        processed_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(
      () =>
        sql`CREATE INDEX idx_role_sync_events_unprocessed ON role_sync_events(created_at) WHERE processed_at IS NULL`,
    ),
  ),
);
