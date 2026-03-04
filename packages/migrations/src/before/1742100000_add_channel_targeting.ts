import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE events ADD COLUMN discord_target_channel_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE event_series ADD COLUMN discord_target_channel_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE training_types ADD COLUMN discord_channel_id TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_training TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_match TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_tournament TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_meeting TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_social TEXT`),
    Effect.tap(() => sql`ALTER TABLE team_settings ADD COLUMN discord_channel_other TEXT`),
    Effect.tap(() => sql`ALTER TABLE event_sync_events ADD COLUMN discord_target_channel_id TEXT`),
  ),
);
