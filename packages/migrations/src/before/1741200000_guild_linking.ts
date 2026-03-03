import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.all(
    [
      // 1. Create bot_guilds table
      sql`CREATE TABLE bot_guilds (
      guild_id TEXT PRIMARY KEY,
      guild_name TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,

      // 2. Create pending_teams archive table
      sql`CREATE TABLE pending_teams (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL
    )`,

      // 3. Archive guildless teams
      sql`INSERT INTO pending_teams (id, name, created_by, created_at)
      SELECT id, name, created_by, created_at FROM teams WHERE guild_id IS NULL`,

      // 4a. Clean up member_roles (via team_members join)
      sql`DELETE FROM member_roles WHERE team_member_id IN (
      SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE t.guild_id IS NULL
    )`,

      // 4b. Clean up roster_members (via rosters join)
      sql`DELETE FROM roster_members WHERE roster_id IN (
      SELECT r.id FROM rosters r JOIN teams t ON r.team_id = t.id WHERE t.guild_id IS NULL
    )`,

      // 4c. Clean up rosters
      sql`DELETE FROM rosters WHERE team_id IN (
      SELECT id FROM teams WHERE guild_id IS NULL
    )`,

      // 4d. Clean up notifications (via team_id)
      sql`DELETE FROM notifications WHERE team_id IN (
      SELECT id FROM teams WHERE guild_id IS NULL
    )`,

      // 4e. Clean up training_types
      sql`DELETE FROM training_types WHERE team_id IN (
      SELECT id FROM teams WHERE guild_id IS NULL
    )`,

      // 4f. Clean up team_invites
      sql`DELETE FROM team_invites WHERE team_id IN (
      SELECT id FROM teams WHERE guild_id IS NULL
    )`,

      // 4g. Clean up team_members
      sql`DELETE FROM team_members WHERE team_id IN (
      SELECT id FROM teams WHERE guild_id IS NULL
    )`,

      // 5. Delete guildless teams (ON DELETE CASCADE handles: roles, role_permissions,
      //    role_groups, groups, group_members, discord_role_mappings, discord_channel_mappings,
      //    age_threshold_rules, channel_sync_events, role_sync_events)
      sql`DELETE FROM teams WHERE guild_id IS NULL`,

      // 6. Make guild_id NOT NULL
      sql`ALTER TABLE teams ALTER COLUMN guild_id SET NOT NULL`,

      // 7. Add UNIQUE constraint on guild_id
      sql`ALTER TABLE teams ADD CONSTRAINT teams_guild_id_unique UNIQUE (guild_id)`,

      // 8. Delete sessions (force re-auth for new OAuth scope)
      sql`DELETE FROM sessions`,
    ],
    { concurrency: 1 },
  ),
);
