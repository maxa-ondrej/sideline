import { Discord } from '@sideline/domain';
import { Option, Schema } from 'effect';

const Nullish = <S extends Schema.Schema.Any>(schema: S) =>
  Schema.OptionFromNullishOr(schema, null);

/** Subset of dfx GuildChannelResponse for text channel sync. type: 0 acts as a filter. */
export const DfxTextChannel = Schema.Struct({
  id: Discord.Snowflake,
  name: Schema.String,
  type: Schema.Literal(0),
  parent_id: Nullish(Discord.Snowflake),
});

/** Subset of dfx UserResponse. */
export const DfxUser = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  avatar: Nullish(Schema.String),
  bot: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

/** Subset of dfx GuildMemberResponse for member sync. */
export const DfxGuildMember = Schema.Struct({
  user: DfxUser,
  roles: Schema.Array(Schema.String),
});

/** Subset of dfx GuildWithCountsResponse from getGuild. */
export const DfxGuild = Schema.Struct({
  system_channel_id: Nullish(Schema.String),
  preferred_locale: Schema.String,
});

/** Extract discord user id from a guild or DM interaction. */
export const interactionUserId = (interaction: {
  member?: { user?: { id: string } } | null;
  user?: { id: string } | null;
}): Option.Option<string> =>
  Option.fromNullable(interaction.member?.user?.id ?? interaction.user?.id);
