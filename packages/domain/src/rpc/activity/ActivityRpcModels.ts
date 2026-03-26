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
