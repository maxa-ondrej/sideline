import { Discord } from '@sideline/domain';
import { Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class DividerRow extends Schema.Class<DividerRow>('DividerRow')({
  discord_message_id: Discord.Snowflake,
}) {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findByChannelQuery = SqlSchema.findOneOption({
    Request: Discord.Snowflake,
    Result: DividerRow,
    execute: (channelId) =>
      sql`SELECT discord_message_id FROM channel_event_dividers WHERE discord_channel_id = ${channelId}`,
  });

  const upsertQuery = SqlSchema.void({
    Request: Schema.Struct({
      discord_channel_id: Discord.Snowflake,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (input) =>
      sql`INSERT INTO channel_event_dividers (discord_channel_id, discord_message_id) VALUES (${input.discord_channel_id}, ${input.discord_message_id}) ON CONFLICT (discord_channel_id) DO UPDATE SET discord_message_id = EXCLUDED.discord_message_id`,
  });

  const deleteByChannelQuery = SqlSchema.void({
    Request: Discord.Snowflake,
    execute: (channelId) =>
      sql`DELETE FROM channel_event_dividers WHERE discord_channel_id = ${channelId}`,
  });

  const findByChannelId = (channelId: Discord.Snowflake) =>
    findByChannelQuery(channelId).pipe(
      Effect.map(Option.map((row) => row.discord_message_id)),
      catchSqlErrors,
    );

  const upsert = (channelId: Discord.Snowflake, messageId: Discord.Snowflake) =>
    upsertQuery({ discord_channel_id: channelId, discord_message_id: messageId }).pipe(
      catchSqlErrors,
    );

  const deleteByChannelId = (channelId: Discord.Snowflake) =>
    deleteByChannelQuery(channelId).pipe(catchSqlErrors);

  return {
    findByChannelId,
    upsert,
    deleteByChannelId,
  };
});

export class ChannelEventDividersRepository extends ServiceMap.Service<
  ChannelEventDividersRepository,
  Effect.Success<typeof make>
>()('api/ChannelEventDividersRepository') {
  static readonly Default = Layer.effect(ChannelEventDividersRepository, make);
}
