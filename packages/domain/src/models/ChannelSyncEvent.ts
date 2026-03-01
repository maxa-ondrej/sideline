import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { SubgroupId } from '~/models/SubgroupModel.js';
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

export class ChannelSyncEvent extends Model.Class<ChannelSyncEvent>('ChannelSyncEvent')({
  id: Model.Generated(ChannelSyncEventId),
  team_id: TeamId,
  guild_id: Schema.String,
  event_type: ChannelSyncEventType,
  subgroup_id: SubgroupId,
  subgroup_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(TeamMemberId),
  discord_user_id: Schema.NullOr(Schema.String),
  processed_at: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
