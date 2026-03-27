import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class ActivityStatsResponse extends Schema.Class<ActivityStatsResponse>(
  'ActivityStatsResponse',
)({
  currentStreak: Schema.Int,
  longestStreak: Schema.Int,
  totalActivities: Schema.Int,
  totalDurationMinutes: Schema.Int,
  gymCount: Schema.Int,
  runningCount: Schema.Int,
  stretchingCount: Schema.Int,
}) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  'ActivityStatsMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'ActivityStatsForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class ActivityStatsApiGroup extends HttpApiGroup.make('activityStats').add(
  HttpApiEndpoint.get('getMemberStats', '/teams/:teamId/members/:memberId/activity-stats')
    .addSuccess(ActivityStatsResponse)
    .addError(MemberNotFound)
    .addError(Forbidden)
    .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
    .middleware(AuthMiddleware),
) {}
