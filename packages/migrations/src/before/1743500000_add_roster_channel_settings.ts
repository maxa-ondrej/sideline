import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN create_discord_channel_on_roster BOOLEAN NOT NULL DEFAULT true`,
    ),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN roster_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN roster_name TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN existing_channel_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN discord_role_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ALTER COLUMN group_id DROP NOT NULL`),
    Effect.tap(
      () =>
        sql`ALTER TABLE channel_sync_events ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'group'`,
    ),
    Effect.tap(() => sql`ALTER TABLE discord_channel_mappings ADD COLUMN roster_id TEXT`),
    Effect.tap(
      () =>
        sql`ALTER TABLE discord_channel_mappings ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'group'`,
    ),
    Effect.tap(() => sql`ALTER TABLE discord_channel_mappings ALTER COLUMN group_id DROP NOT NULL`),
    Effect.tap(
      () =>
        sql`DO $$ BEGIN
          ALTER TABLE discord_channel_mappings DROP CONSTRAINT IF EXISTS discord_channel_mappings_team_id_group_id_key;
          ALTER TABLE discord_channel_mappings DROP CONSTRAINT IF EXISTS discord_channel_mappings_team_id_subgroup_id_key;
        END $$`,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX discord_channel_mappings_team_group ON discord_channel_mappings (team_id, group_id) WHERE group_id IS NOT NULL`,
    ),
    Effect.tap(
      () =>
        sql`CREATE UNIQUE INDEX discord_channel_mappings_team_roster ON discord_channel_mappings (team_id, roster_id) WHERE roster_id IS NOT NULL`,
    ),
  ),
);
