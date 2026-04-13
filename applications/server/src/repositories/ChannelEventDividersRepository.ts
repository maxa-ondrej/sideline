import { Discord } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class DividerRow extends Schema.Class<DividerRow>('DividerRow')({
  discord_message_id: Discord.Snowflake,
}) {}

export class ChannelEventDividersRepository extends Effect.Service<ChannelEventDividersRepository>()(
  'api/ChannelEventDividersRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByChannelQuery = SqlSchema.findOne({
    Request: Discord.Snowflake,
    Result: DividerRow,
    execute: (channelId) =>
      this
        .sql`SELECT discord_message_id FROM channel_event_dividers WHERE discord_channel_id = ${channelId}`,
  });

  private upsertQuery = SqlSchema.void({
    Request: Schema.Struct({
      discord_channel_id: Discord.Snowflake,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (input) =>
      this
        .sql`INSERT INTO channel_event_dividers (discord_channel_id, discord_message_id) VALUES (${input.discord_channel_id}, ${input.discord_message_id}) ON CONFLICT (discord_channel_id) DO UPDATE SET discord_message_id = EXCLUDED.discord_message_id`,
  });

  private deleteByChannelQuery = SqlSchema.void({
    Request: Discord.Snowflake,
    execute: (channelId) =>
      this.sql`DELETE FROM channel_event_dividers WHERE discord_channel_id = ${channelId}`,
  });

  findByChannelId = (channelId: Discord.Snowflake) =>
    this.findByChannelQuery(channelId).pipe(
      Effect.map(Option.map((row) => row.discord_message_id)),
      catchSqlErrors,
    );

  upsert = (channelId: Discord.Snowflake, messageId: Discord.Snowflake) =>
    this.upsertQuery({ discord_channel_id: channelId, discord_message_id: messageId }).pipe(
      catchSqlErrors,
    );

  deleteByChannelId = (channelId: Discord.Snowflake) =>
    this.deleteByChannelQuery(channelId).pipe(catchSqlErrors);
}
