import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
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
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('upsertGuild', ({ sql }) =>
        SqlSchema.void({
          Request: UpsertInput,
          execute: (input) => sql`
            INSERT INTO bot_guilds (guild_id, guild_name)
            VALUES (${input.guild_id}, ${input.guild_name})
            ON CONFLICT (guild_id) DO UPDATE SET guild_name = ${input.guild_name}
          `,
        }),
      ),
      Effect.let('removeGuild', ({ sql }) =>
        SqlSchema.void({
          Request: Discord.Snowflake,
          execute: (guildId) => sql`
            DELETE FROM bot_guilds WHERE guild_id = ${guildId}
          `,
        }),
      ),
      Effect.let('existsGuild', ({ sql }) =>
        SqlSchema.single({
          Request: Discord.Snowflake,
          Result: ExistsResult,
          execute: (guildId) => sql`
            SELECT EXISTS(SELECT 1 FROM bot_guilds WHERE guild_id = ${guildId}) AS exists
          `,
        }),
      ),
      Effect.let('findAllGuilds', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Void,
          Result: BotGuildRow,
          execute: () => sql`SELECT guild_id, guild_name FROM bot_guilds ORDER BY guild_name`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  upsert(guildId: Discord.Snowflake, guildName: string) {
    return this.upsertGuild({ guild_id: guildId, guild_name: guildName });
  }

  remove(guildId: Discord.Snowflake) {
    return this.removeGuild(guildId);
  }

  exists(guildId: Discord.Snowflake) {
    return this.existsGuild(guildId).pipe(Effect.map((r) => r.exists));
  }

  findAll() {
    return this.findAllGuilds(undefined);
  }
}
