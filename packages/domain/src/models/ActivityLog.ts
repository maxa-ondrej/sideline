import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamMemberId } from '~/models/TeamMember.js';

export const ActivityLogId = Schema.String.pipe(Schema.brand('ActivityLogId'));
export type ActivityLogId = typeof ActivityLogId.Type;

export const ActivityType = Schema.Literal('gym', 'running', 'stretching');
export type ActivityType = typeof ActivityType.Type;

export class ActivityLog extends Model.Class<ActivityLog>('ActivityLog')({
  id: Model.Generated(ActivityLogId),
  team_member_id: TeamMemberId,
  activity_type: ActivityType,
  logged_at: Model.DateTimeInsertFromDate,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
