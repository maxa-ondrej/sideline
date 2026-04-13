import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) =>
    sql`CREATE TABLE channel_event_dividers (
    discord_channel_id TEXT PRIMARY KEY,
    discord_message_id TEXT NOT NULL
  )`,
);
