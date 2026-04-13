import { Discord } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

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

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const _upsertGuild = SqlSchema.void({
    Request: UpsertInput,
    execute: (input) => sql`
      INSERT INTO bot_guilds (guild_id, guild_name)
      VALUES (${input.guild_id}, ${input.guild_name})
      ON CONFLICT (guild_id) DO UPDATE SET guild_name = ${input.guild_name}
    `,
  });

  const _removeGuild = SqlSchema.void({
    Request: Discord.Snowflake,
    execute: (guildId) => sql`
      DELETE FROM bot_guilds WHERE guild_id = ${guildId}
    `,
  });

  const _existsGuild = SqlSchema.findOne({
    Request: Discord.Snowflake,
    Result: ExistsResult,
    execute: (guildId) => sql`
      SELECT EXISTS(SELECT 1 FROM bot_guilds WHERE guild_id = ${guildId}) AS exists
    `,
  });

  const _findAllGuilds = SqlSchema.findAll({
    Request: Schema.Void,
    Result: BotGuildRow,
    execute: () => sql`SELECT guild_id, guild_name FROM bot_guilds ORDER BY guild_name`,
  });

  const upsert = (guildId: Discord.Snowflake, guildName: string) =>
    _upsertGuild({ guild_id: guildId, guild_name: guildName }).pipe(catchSqlErrors);

  const remove = (guildId: Discord.Snowflake) => _removeGuild(guildId).pipe(catchSqlErrors);

  const exists = (guildId: Discord.Snowflake) =>
    _existsGuild(guildId).pipe(
      Effect.map((r) => r.exists),
      catchSqlErrors,
      Effect.catchTag(
        'NoSuchElementException',
        LogicError.withMessage((e) => `Guild existence check returned no row: ${e}`),
      ),
    );

  const findAll = () => _findAllGuilds(undefined).pipe(catchSqlErrors);

  return {
    upsert,
    remove,
    exists,
    findAll,
  };
});

export class BotGuildsRepository extends ServiceMap.Service<
  BotGuildsRepository,
  Effect.Success<typeof make>
>()('api/BotGuildsRepository') {
  static readonly Default = Layer.effect(BotGuildsRepository, make);
}
