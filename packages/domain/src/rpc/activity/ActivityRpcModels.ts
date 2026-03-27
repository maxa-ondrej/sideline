import { Schema } from 'effect';
import { ActivityLogId, ActivityType } from '~/models/ActivityLog.js';

export class LogActivityResult extends Schema.Class<LogActivityResult>('LogActivityResult')({
  id: ActivityLogId,
  activity_type: ActivityType,
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
  gym_count: Schema.Int,
  running_count: Schema.Int,
  stretching_count: Schema.Int,
}) {}
