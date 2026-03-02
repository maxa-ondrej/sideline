import { Schema } from 'effect';
import { Discord, DiscordChannelMapping, GroupModel, Team } from '~/index.js';

export class ChannelMapping extends Schema.Class<ChannelMapping>('ChannelMapping')({
  id: DiscordChannelMapping.DiscordChannelMappingId,
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}
