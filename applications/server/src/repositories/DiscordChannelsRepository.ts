import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord } from '@sideline/domain';
import { Array, Effect, type Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class ChannelRow extends Schema.Class<ChannelRow>('ChannelRow')({
  channel_id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Number,
  parent_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class SyncInput extends Schema.Class<SyncInput>('SyncInput')({
  guild_id: Discord.Snowflake,
  channel_id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Number,
  parent_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

export class DiscordChannelsRepository extends Effect.Service<DiscordChannelsRepository>()(
  'api/DiscordChannelsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private deleteByGuild = SqlSchema.void({
    Request: Discord.Snowflake,
    execute: (guildId) => this.sql`
      DELETE FROM discord_channels WHERE guild_id = ${guildId}
    `,
  });

  private insertChannel = SqlSchema.void({
    Request: SyncInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channels (guild_id, channel_id, name, type, parent_id)
      VALUES (${input.guild_id}, ${input.channel_id}, ${input.name}, ${input.type}, ${input.parent_id})
    `,
  });

  private selectByGuild = SqlSchema.findAll({
    Request: Discord.Snowflake,
    Result: ChannelRow,
    execute: (guildId) => this.sql`
      SELECT channel_id, name, type, parent_id
      FROM discord_channels
      WHERE guild_id = ${guildId}
      ORDER BY name
    `,
  });

  syncChannels = (
    guildId: Discord.Snowflake,
    channels: ReadonlyArray<{
      readonly channel_id: Discord.Snowflake;
      readonly name: string;
      readonly type: number;
      readonly parent_id: Option.Option<Discord.Snowflake>;
    }>,
  ) =>
    this.deleteByGuild(guildId).pipe(
      Effect.tap(() =>
        Effect.all(
          Array.map(channels, (ch) =>
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
      catchSqlErrors,
    );

  updateChannelName = (channelId: Discord.Snowflake, name: string) =>
    SqlSchema.void({
      Request: Schema.Struct({ channel_id: Discord.Snowflake, name: Schema.String }),
      execute: (input) => this.sql`
        UPDATE discord_channels SET name = ${input.name} WHERE channel_id = ${input.channel_id}
      `,
    })({ channel_id: channelId, name }).pipe(catchSqlErrors);

  upsertChannel = (
    guildId: Discord.Snowflake,
    channelId: Discord.Snowflake,
    name: string,
    type: number,
    parentId: Option.Option<Discord.Snowflake>,
  ) =>
    SqlSchema.void({
      Request: SyncInput,
      execute: (input) => this.sql`
        INSERT INTO discord_channels (guild_id, channel_id, name, type, parent_id)
        VALUES (${input.guild_id}, ${input.channel_id}, ${input.name}, ${input.type}, ${input.parent_id})
        ON CONFLICT (guild_id, channel_id)
        DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_id = EXCLUDED.parent_id
      `,
    })({ guild_id: guildId, channel_id: channelId, name, type, parent_id: parentId }).pipe(
      catchSqlErrors,
    );

  findByGuildId = (guildId: Discord.Snowflake) => this.selectByGuild(guildId).pipe(catchSqlErrors);
}
