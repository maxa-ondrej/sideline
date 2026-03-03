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

      // 4. Delete guildless teams (ON DELETE CASCADE handles all child tables)
      sql`DELETE FROM teams WHERE guild_id IS NULL`,

      // 5. Make guild_id NOT NULL
      sql`ALTER TABLE teams ALTER COLUMN guild_id SET NOT NULL`,

      // 6. Add UNIQUE constraint on guild_id
      sql`ALTER TABLE teams ADD CONSTRAINT teams_guild_id_unique UNIQUE (guild_id)`,

      // 7. Delete sessions (force re-auth for new OAuth scope)
      sql`DELETE FROM sessions`,
    ],
    { concurrency: 1 },
  ),
);
