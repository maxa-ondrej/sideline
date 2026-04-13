import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { ActivityTypeId } from '~/models/ActivityType.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const ActivityLogId = Schema.String.pipe(Schema.brand('ActivityLogId'));
export type ActivityLogId = typeof ActivityLogId.Type;

export const ActivitySource = Schema.Literal('manual', 'auto');
export type ActivitySource = typeof ActivitySource.Type;

export class ActivityLog extends Model.Class<ActivityLog>('ActivityLog')({
  id: Model.Generated(ActivityLogId),
  team_member_id: TeamMemberId,
  activity_type_id: ActivityTypeId,
  logged_at: Model.DateTimeInsertFromDate,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivitySource,
  created_at: Model.DateTimeInsertFromDate,
}) {}
