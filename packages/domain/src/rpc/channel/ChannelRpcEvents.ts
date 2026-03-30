import { Schema } from 'effect';
import { ChannelSyncEvent, Discord, GroupModel, RosterModel, Team, TeamMember } from '~/index.js';

// --- channel_created ---

export class GroupChannelCreatedEvent extends Schema.TaggedClass<GroupChannelCreatedEvent>()(
  'group_channel_created',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    group_id: GroupModel.GroupId,
    group_name: Schema.String,
    existing_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  },
) {}

export class RosterChannelCreatedEvent extends Schema.TaggedClass<RosterChannelCreatedEvent>()(
  'roster_channel_created',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    roster_id: RosterModel.RosterId,
    roster_name: Schema.String,
    existing_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  },
) {}

export const ChannelCreatedEvent = Schema.Union(
  GroupChannelCreatedEvent,
  RosterChannelCreatedEvent,
);
export type ChannelCreatedEvent = Schema.Schema.Type<typeof ChannelCreatedEvent>;

// --- channel_deleted ---

export class GroupChannelDeletedEvent extends Schema.TaggedClass<GroupChannelDeletedEvent>()(
  'group_channel_deleted',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    group_id: GroupModel.GroupId,
  },
) {}

export class RosterChannelDeletedEvent extends Schema.TaggedClass<RosterChannelDeletedEvent>()(
  'roster_channel_deleted',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    roster_id: RosterModel.RosterId,
  },
) {}

export const ChannelDeletedEvent = Schema.Union(
  GroupChannelDeletedEvent,
  RosterChannelDeletedEvent,
);
export type ChannelDeletedEvent = Schema.Schema.Type<typeof ChannelDeletedEvent>;

// --- member_added ---

export class GroupMemberAddedEvent extends Schema.TaggedClass<GroupMemberAddedEvent>()(
  'group_member_added',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    group_id: GroupModel.GroupId,
    group_name: Schema.String,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export class RosterMemberAddedEvent extends Schema.TaggedClass<RosterMemberAddedEvent>()(
  'roster_member_added',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    roster_id: RosterModel.RosterId,
    roster_name: Schema.String,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export const ChannelMemberAddedEvent = Schema.Union(GroupMemberAddedEvent, RosterMemberAddedEvent);
export type ChannelMemberAddedEvent = Schema.Schema.Type<typeof ChannelMemberAddedEvent>;

// --- member_removed ---

export class GroupMemberRemovedEvent extends Schema.TaggedClass<GroupMemberRemovedEvent>()(
  'group_member_removed',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    group_id: GroupModel.GroupId,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export class RosterMemberRemovedEvent extends Schema.TaggedClass<RosterMemberRemovedEvent>()(
  'roster_member_removed',
  {
    id: ChannelSyncEvent.ChannelSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    roster_id: RosterModel.RosterId,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export const ChannelMemberRemovedEvent = Schema.Union(
  GroupMemberRemovedEvent,
  RosterMemberRemovedEvent,
);
export type ChannelMemberRemovedEvent = Schema.Schema.Type<typeof ChannelMemberRemovedEvent>;

// --- union of all ---

export const UnprocessedChannelEvent = Schema.Union(
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelMemberAddedEvent,
  ChannelMemberRemovedEvent,
);

export type UnprocessedChannelEvent = Schema.Schema.Type<typeof UnprocessedChannelEvent>;
