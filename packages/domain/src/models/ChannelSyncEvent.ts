import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { GroupId } from '~/models/GroupModel.js';
import { RosterId } from '~/models/RosterModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const ChannelSyncEventId = Schema.String.pipe(Schema.brand('ChannelSyncEventId'));
export type ChannelSyncEventId = typeof ChannelSyncEventId.Type;

export const ChannelSyncEventType = Schema.Literal(
  'channel_created',
  'channel_deleted',
  'member_added',
  'member_removed',
);
export type ChannelSyncEventType = typeof ChannelSyncEventType.Type;

export const ChannelSyncEntityType = Schema.Literal('group', 'roster');
export type ChannelSyncEntityType = typeof ChannelSyncEntityType.Type;

export class ChannelSyncEvent extends Model.Class<ChannelSyncEvent>('ChannelSyncEvent')({
  id: Model.Generated(ChannelSyncEventId),
  team_id: TeamId,
  guild_id: Schema.String,
  event_type: ChannelSyncEventType,
  entity_type: ChannelSyncEntityType,
  group_id: Schema.OptionFromNullOr(GroupId),
  group_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Schema.String),
  roster_id: Schema.OptionFromNullOr(RosterId),
  roster_name: Schema.OptionFromNullOr(Schema.String),
  existing_channel_id: Schema.OptionFromNullOr(Schema.String),
  discord_role_id: Schema.OptionFromNullOr(Schema.String),
  processed_at: Schema.OptionFromNullOr(Schema.String),
  error: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
