import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { GroupId } from '~/models/GroupModel.js';
import { TeamChannelId } from '~/models/TeamChannel.js';

export const AccessLevel = Schema.Literals(['VIEW', 'EDIT', 'ADMIN']);
export type AccessLevel = typeof AccessLevel.Type;

export class TeamChannelAccess extends Model.Class<TeamChannelAccess>('TeamChannelAccess')({
  team_channel_id: TeamChannelId,
  group_id: GroupId,
  access_level: AccessLevel,
  created_at: Model.DateTimeInsertFromDate,
}) {}
