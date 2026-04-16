import { Discord } from '@sideline/domain';
import { Option, Schema } from 'effect';

const Nullish = <S extends Schema.Top>(schema: S) =>
  Schema.OptionFromNullishOr(schema, { onNoneEncoding: null });

/** Subset of dfx GuildChannelResponse for text channel sync. type: 0 acts as a filter. */
export const DfxTextChannel = Schema.Struct({
  id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Literal(0),
  parent_id: Nullish(Discord.Snowflake),
});

/** Subset of dfx GuildChannelResponse for synced channel types (text + category). */
export const DfxSyncableChannel = Schema.Struct({
  id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Literals([0, 4]),
  parent_id: Nullish(Discord.Snowflake),
});

/** Subset of dfx UserResponse. */
export const DfxUser = Schema.Struct({
  id: Discord.Snowflake,
  username: Schema.String,
  avatar: Nullish(Schema.String),
  global_name: Nullish(Schema.String),
  bot: Schema.optional(Schema.Boolean),
});

/** Subset of dfx GuildMemberResponse for member sync. */
export const DfxGuildMember = Schema.Struct({
  user: DfxUser,
  roles: Schema.Array(Discord.Snowflake),
  nick: Nullish(Schema.String),
});

/** Subset of dfx GuildWithCountsResponse from getGuild. */
export const DfxGuild = Schema.Struct({
  system_channel_id: Nullish(Discord.Snowflake),
  preferred_locale: Schema.String,
});

/** Extract discord user id from a guild or DM interaction. */
export const interactionUserId = (interaction: {
  member?: { user?: { id: string } } | null;
  user?: { id: string } | null;
}): Option.Option<Discord.Snowflake> =>
  Option.map(
    Option.fromNullishOr(interaction.member?.user?.id ?? interaction.user?.id),
    Discord.Snowflake.makeUnsafe,
  );
