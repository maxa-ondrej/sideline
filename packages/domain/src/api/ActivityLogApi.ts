import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { ActivityLogId, ActivitySource } from '~/models/ActivityLog.js';
import { ActivityTypeId } from '~/models/ActivityType.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class ActivityLogEntry extends Schema.Class<ActivityLogEntry>('ActivityLogEntry')({
  id: ActivityLogId,
  activityTypeId: ActivityTypeId,
  activityTypeName: Schema.String,
  loggedAt: Schema.String,
  durationMinutes: Schema.OptionFromNullOr(Schema.Int),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivitySource,
}) {}

export class ActivityLogListResponse extends Schema.Class<ActivityLogListResponse>(
  'ActivityLogListResponse',
)({
  logs: Schema.Array(ActivityLogEntry),
}) {}

export class CreateActivityLogRequest extends Schema.Class<CreateActivityLogRequest>(
  'CreateActivityLogRequest',
)({
  activityTypeId: ActivityTypeId,
  durationMinutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
}) {}

export class UpdateActivityLogRequest extends Schema.Class<UpdateActivityLogRequest>(
  'UpdateActivityLogRequest',
)({
  activityTypeId: Schema.optionalWith(ActivityTypeId, { as: 'Option' }),
  durationMinutes: Schema.optionalWith(
    Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
    { as: 'Option' },
  ),
  note: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
}) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  'ActivityLogMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'ActivityLogForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class LogNotFound extends Schema.TaggedError<LogNotFound>()(
  'ActivityLogNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class MemberInactive extends Schema.TaggedError<MemberInactive>()(
  'ActivityLogMemberInactive',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class AutoSourceForbidden extends Schema.TaggedError<AutoSourceForbidden>()(
  'ActivityLogAutoSourceForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class ActivityLogApiGroup extends HttpApiGroup.make('activityLog')
  .add(
    HttpApiEndpoint.get('listLogs', '/teams/:teamId/members/:memberId/activity-logs')
      .addSuccess(ActivityLogListResponse)
      .addError(MemberNotFound, { status: 404 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createLog', '/teams/:teamId/members/:memberId/activity-logs')
      .addSuccess(ActivityLogEntry, { status: 201 })
      .addError(MemberNotFound, { status: 404 })
      .addError(Forbidden, { status: 403 })
      .addError(MemberInactive, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .setPayload(CreateActivityLogRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateLog', '/teams/:teamId/members/:memberId/activity-logs/:logId')
      .addSuccess(ActivityLogEntry)
      .addError(LogNotFound, { status: 404 })
      .addError(Forbidden, { status: 403 })
      .addError(MemberInactive, { status: 403 })
      .addError(AutoSourceForbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId, logId: ActivityLogId }))
      .setPayload(UpdateActivityLogRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post(
      'deleteLog',
      '/teams/:teamId/members/:memberId/activity-logs/:logId/delete',
    )
      .addSuccess(Schema.Void, { status: 204 })
      .addError(LogNotFound, { status: 404 })
      .addError(Forbidden, { status: 403 })
      .addError(MemberInactive, { status: 403 })
      .addError(AutoSourceForbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId, logId: ActivityLogId }))
      .middleware(AuthMiddleware),
  ) {}
