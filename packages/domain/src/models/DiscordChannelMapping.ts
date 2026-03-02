import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';

export const DiscordChannelMappingId = Schema.String.pipe(Schema.brand('DiscordChannelMappingId'));
export type DiscordChannelMappingId = typeof DiscordChannelMappingId.Type;

export class DiscordChannelMapping extends Model.Class<DiscordChannelMapping>(
  'DiscordChannelMapping',
)({
  id: Model.Generated(DiscordChannelMappingId),
  team_id: TeamId,
  group_id: GroupId,
  discord_channel_id: Schema.String,
  discord_role_id: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
