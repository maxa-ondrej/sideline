import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class ChannelRow extends Schema.Class<ChannelRow>('ChannelRow')({
  channel_id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Number,
  parent_id: Schema.NullOr(Discord.Snowflake),
}) {}

class SyncInput extends Schema.Class<SyncInput>('SyncInput')({
  guild_id: Discord.Snowflake,
  channel_id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Number,
  parent_id: Schema.NullOr(Discord.Snowflake),
}) {}

export class DiscordChannelsRepository extends Effect.Service<DiscordChannelsRepository>()(
  'api/DiscordChannelsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('deleteByGuild', ({ sql }) =>
        SqlSchema.void({
          Request: Discord.Snowflake,
          execute: (guildId) => sql`
            DELETE FROM discord_channels WHERE guild_id = ${guildId}
          `,
        }),
      ),
      Effect.let('insertChannel', ({ sql }) =>
        SqlSchema.void({
          Request: SyncInput,
          execute: (input) => sql`
            INSERT INTO discord_channels (guild_id, channel_id, name, type, parent_id)
            VALUES (${input.guild_id}, ${input.channel_id}, ${input.name}, ${input.type}, ${input.parent_id})
          `,
        }),
      ),
      Effect.let('selectByGuild', ({ sql }) =>
        SqlSchema.findAll({
          Request: Discord.Snowflake,
          Result: ChannelRow,
          execute: (guildId) => sql`
            SELECT channel_id, name, type, parent_id
            FROM discord_channels
            WHERE guild_id = ${guildId}
            ORDER BY name
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  syncChannels(
    guildId: Discord.Snowflake,
    channels: ReadonlyArray<{
      readonly channel_id: Discord.Snowflake;
      readonly name: string;
      readonly type: number;
      readonly parent_id: Discord.Snowflake | null;
    }>,
  ) {
    return this.deleteByGuild(guildId).pipe(
      Effect.tap(() =>
        Effect.all(
          channels.map((ch) =>
            this.insertChannel({
              guild_id: guildId,
              channel_id: ch.channel_id,
              name: ch.name,
              type: ch.type,
              parent_id: ch.parent_id,
            }),
          ),
          { concurrency: 1 },
        ),
      ),
    );
  }

  findByGuildId(guildId: Discord.Snowflake) {
    return this.selectByGuild(guildId);
  }
}
