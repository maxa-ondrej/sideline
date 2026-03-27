import { Schema } from 'effect';
import { ActivityLogId } from '~/models/ActivityLog.js';

export class LogActivityResult extends Schema.Class<LogActivityResult>('LogActivityResult')({
  id: ActivityLogId,
  activity_type_id: Schema.String,
  logged_at: Schema.String,
}) {}

export class ActivityMemberNotFound extends Schema.TaggedError<ActivityMemberNotFound>()(
  'ActivityMemberNotFound',
  {},
) {}

export class ActivityGuildNotFound extends Schema.TaggedError<ActivityGuildNotFound>()(
  'ActivityGuildNotFound',
  {},
) {}

export class GetStatsResult extends Schema.Class<GetStatsResult>('GetStatsResult')({
  current_streak: Schema.Int,
  longest_streak: Schema.Int,
  total_activities: Schema.Int,
  total_duration_minutes: Schema.Int,
  counts: Schema.Array(
    Schema.Struct({
      activity_type_id: Schema.String,
      activity_type_name: Schema.String,
      count: Schema.Int,
    }),
  ),
}) {}
