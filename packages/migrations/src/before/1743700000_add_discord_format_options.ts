import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN discord_role_format TEXT NOT NULL DEFAULT '{emoji} {name}'`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE team_settings ADD COLUMN discord_channel_format TEXT NOT NULL DEFAULT '{emoji}│{name}'`,
    ),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN discord_channel_name TEXT`),
    Effect.tap(() => sql`ALTER TABLE channel_sync_events ADD COLUMN discord_role_name TEXT`),
  ),
);
