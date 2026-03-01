import { Schema } from 'effect';
import { ChannelSyncEvent, Discord, SubgroupModel, Team, TeamMember } from '~/index.js';

export class ChannelCreatedEvent extends Schema.TaggedClass<ChannelCreatedEvent>()(
  'channel_created',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    subgroup_id: SubgroupModel.SubgroupId,
    subgroup_name: Schema.String,
  },
) {}

export class ChannelDeletedEvent extends Schema.TaggedClass<ChannelDeletedEvent>()(
  'channel_deleted',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    subgroup_id: SubgroupModel.SubgroupId,
  },
) {}

export class ChannelMemberAddedEvent extends Schema.TaggedClass<ChannelMemberAddedEvent>()(
  'channel_member_added',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    subgroup_id: SubgroupModel.SubgroupId,
    subgroup_name: Schema.String,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export class ChannelMemberRemovedEvent extends Schema.TaggedClass<ChannelMemberRemovedEvent>()(
  'channel_member_removed',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    subgroup_id: SubgroupModel.SubgroupId,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export const UnprocessedChannelEvent = Schema.Union(
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelMemberAddedEvent,
  ChannelMemberRemovedEvent,
);

export type UnprocessedChannelEvent = Schema.Schema.Type<typeof UnprocessedChannelEvent>;
