import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  Effect.service(SqlClient.SqlClient),
  (sql) =>
    sql`ALTER TABLE team_settings ADD COLUMN create_discord_channel_on_group BOOLEAN NOT NULL DEFAULT true`,
);
