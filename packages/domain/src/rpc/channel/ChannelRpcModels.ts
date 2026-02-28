import { Schema } from 'effect';
import { Discord, DiscordChannelMapping, SubgroupModel, Team } from '~/index.js';

export class ChannelMapping extends Schema.Class<ChannelMapping>('ChannelMapping')({
  id: DiscordChannelMapping.DiscordChannelMappingId,
  team_id: Team.TeamId,
  subgroup_id: SubgroupModel.SubgroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Schema.Option(Discord.Snowflake),
}) {}
