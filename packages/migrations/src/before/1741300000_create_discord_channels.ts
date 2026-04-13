import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  Effect.service(SqlClient.SqlClient),
  (sql) =>
    sql`CREATE TABLE discord_channels (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL REFERENCES bot_guilds(guild_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    UNIQUE (guild_id, channel_id)
  )`,
);
