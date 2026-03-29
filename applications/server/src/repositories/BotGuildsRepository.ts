import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class UpsertInput extends Schema.Class<UpsertInput>('UpsertInput')({
  guild_id: Discord.Snowflake,
  guild_name: Schema.String,
}) {}

class BotGuildRow extends Schema.Class<BotGuildRow>('BotGuildRow')({
  guild_id: Discord.Snowflake,
  guild_name: Schema.String,
}) {}

class ExistsResult extends Schema.Class<ExistsResult>('ExistsResult')({
  exists: Schema.Boolean,
}) {}

export class BotGuildsRepository extends Effect.Service<BotGuildsRepository>()(
  'api/BotGuildsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _upsertGuild = SqlSchema.void({
    Request: UpsertInput,
    execute: (input) => this.sql`
      INSERT INTO bot_guilds (guild_id, guild_name)
      VALUES (${input.guild_id}, ${input.guild_name})
      ON CONFLICT (guild_id) DO UPDATE SET guild_name = ${input.guild_name}
    `,
  });

  private _removeGuild = SqlSchema.void({
    Request: Discord.Snowflake,
    execute: (guildId) => this.sql`
      DELETE FROM bot_guilds WHERE guild_id = ${guildId}
    `,
  });

  private _existsGuild = SqlSchema.single({
    Request: Discord.Snowflake,
    Result: ExistsResult,
    execute: (guildId) => this.sql`
      SELECT EXISTS(SELECT 1 FROM bot_guilds WHERE guild_id = ${guildId}) AS exists
    `,
  });

  private _findAllGuilds = SqlSchema.findAll({
    Request: Schema.Void,
    Result: BotGuildRow,
    execute: () => this.sql`SELECT guild_id, guild_name FROM bot_guilds ORDER BY guild_name`,
  });

  upsert = (guildId: Discord.Snowflake, guildName: string) =>
    this._upsertGuild({ guild_id: guildId, guild_name: guildName }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  remove = (guildId: Discord.Snowflake) =>
    this._removeGuild(guildId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  exists = (guildId: Discord.Snowflake) =>
    this._existsGuild(guildId).pipe(
      Effect.map((r) => r.exists),
      Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', LogicError.dieFrom),
    );

  findAll = () =>
    this._findAllGuilds(undefined).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );
}
