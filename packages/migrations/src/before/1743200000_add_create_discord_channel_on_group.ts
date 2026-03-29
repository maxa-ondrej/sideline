import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) =>
    sql`ALTER TABLE team_settings ADD COLUMN create_discord_channel_on_group BOOLEAN NOT NULL DEFAULT true`,
);
