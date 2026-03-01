import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE discord_channel_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
        discord_channel_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(team_id, subgroup_id),
        UNIQUE(team_id, discord_channel_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE channel_sync_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('channel_created','channel_deleted','member_added','member_removed')),
        subgroup_id UUID NOT NULL,
        subgroup_name TEXT,
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
        sql`CREATE INDEX idx_channel_sync_events_unprocessed ON channel_sync_events(created_at) WHERE processed_at IS NULL`,
    ),
  ),
);
